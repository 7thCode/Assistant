import OpenAI from "openai";
import {callTool, listAllTools} from "../mcp/mcpClient.js";
import type {ChatCompletionMessageParam, ChatCompletionTool} from "openai/resources/chat/completions";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

/** How many tool-call round-trips a single reply may take before we give up and return whatever text we have. */
const maxToolCallRounds = 5;

export type OpenAiChatMessage = {
    role: "user" | "assistant",
    content: string
};

/** Set from a Keychain-stored key at startup, or updated live from the settings UI. Takes priority over OPENAI_API_KEY. */
let apiKeyOverride: string | undefined;

export function setApiKeyOverride(key: string | undefined) {
    apiKeyOverride = (key != null && key !== "") ? key : undefined;
}

function getEffectiveApiKey(): string | undefined {
    return apiKeyOverride ?? process.env["OPENAI_API_KEY"];
}

/** Set from a persisted setting at startup, or updated live from the settings UI. Takes priority over OPENAI_MODEL. */
let modelOverride: string | undefined;

export function setModelOverride(model: string | undefined) {
    modelOverride = (model != null && model !== "") ? model : undefined;
}

function getEffectiveModel(): string {
    return modelOverride ?? (process.env["OPENAI_MODEL"] || DEFAULT_OPENAI_MODEL);
}

export function isOpenAiAvailable() {
    return getEffectiveApiKey() != null;
}

function getMcpToolsForOpenAi(): ChatCompletionTool[] {
    return listAllTools().map((tool) => ({
        type: "function",
        function: {
            name: tool.qualifiedName,
            description: tool.description,
            parameters: (tool.inputSchema as Record<string, unknown>) ?? {type: "object", properties: {}}
        }
    }));
}

type PendingToolCall = {id: string, name: string, args: string};

export async function streamOpenAiChat({messages, signal, onChunk}: {
    messages: OpenAiChatMessage[],
    signal: AbortSignal,
    onChunk(text: string): void
}): Promise<string> {
    const apiKey = getEffectiveApiKey();
    if (apiKey == null)
        throw new Error("No OpenAI API key is configured");

    const client = new OpenAI({apiKey});
    const tools = getMcpToolsForOpenAi();
    const conversation: ChatCompletionMessageParam[] = messages.map(
        (message) => ({role: message.role, content: message.content})
    );

    let fullText = "";

    for (let round = 0; round <= maxToolCallRounds; round++) {
        const stream = await client.chat.completions.create({
            model: getEffectiveModel(),
            messages: conversation,
            stream: true,
            // reasoning models reject function tools unless reasoning is explicitly turned off
            // (see: "Function tools with reasoning_effort are not supported ... set reasoning_effort to 'none'")
            // eslint-disable-next-line camelcase -- this field name is dictated by the OpenAI API
            ...(tools.length > 0 ? {tools, reasoning_effort: "none" as const} : {})
        }, {signal});

        let roundText = "";
        const toolCallsByIndex = new Map<number, PendingToolCall>();
        let finishReason: string | null = null;

        for await (const chunk of stream) {
            const choice = chunk.choices[0];
            const delta = choice?.delta;

            if (delta?.content != null && delta.content !== "") {
                roundText += delta.content;
                fullText += delta.content;
                onChunk(delta.content);
            }

            for (const toolCallDelta of delta?.tool_calls ?? []) {
                const existing = toolCallsByIndex.get(toolCallDelta.index) ?? {id: "", name: "", args: ""};
                if (toolCallDelta.id != null)
                    existing.id = toolCallDelta.id;
                if (toolCallDelta.function?.name != null)
                    existing.name += toolCallDelta.function.name;
                if (toolCallDelta.function?.arguments != null)
                    existing.args += toolCallDelta.function.arguments;

                toolCallsByIndex.set(toolCallDelta.index, existing);
            }

            if (choice?.finish_reason != null)
                finishReason = choice.finish_reason;
        }

        if (finishReason !== "tool_calls" || toolCallsByIndex.size === 0)
            return fullText;

        const toolCalls = [...toolCallsByIndex.values()];
        /* eslint-disable camelcase -- these field names are dictated by the OpenAI API */
        conversation.push({
            role: "assistant",
            content: roundText === "" ? null : roundText,
            tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: {name: call.name, arguments: call.args}
            }))
        });

        for (const call of toolCalls) {
            let resultText: string;
            try {
                const args: Record<string, unknown> = call.args === "" ? {} : JSON.parse(call.args);
                resultText = await callTool(call.name, args);
            } catch (err) {
                resultText = `Error: ${err instanceof Error ? err.message : String(err)}`;
            }

            conversation.push({
                role: "tool",
                tool_call_id: call.id,
                content: resultText
            });
        }
        /* eslint-enable camelcase */
    }

    return fullText;
}
