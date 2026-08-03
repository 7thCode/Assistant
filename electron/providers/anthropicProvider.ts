import Anthropic from "@anthropic-ai/sdk";
import {callTool, listAllTools} from "../mcp/mcpClient.js";
import type {MessageParam, Tool as AnthropicTool} from "@anthropic-ai/sdk/resources/messages";
import type {ChatMessage} from "./types.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/** How many tool-call round-trips a single reply may take before we give up and return whatever text we have. */
const maxToolCallRounds = 5;

/** Set from a Keychain-stored key at startup, or updated live from the settings UI. Takes priority over ANTHROPIC_API_KEY. */
let apiKeyOverride: string | undefined;

export function setAnthropicApiKeyOverride(key: string | undefined) {
    apiKeyOverride = (key != null && key !== "") ? key : undefined;
}

function getEffectiveApiKey(): string | undefined {
    return apiKeyOverride ?? process.env["ANTHROPIC_API_KEY"];
}

/** Set from a persisted setting at startup, or updated live from the settings UI. Takes priority over ANTHROPIC_MODEL. */
let modelOverride: string | undefined;

export function setAnthropicModelOverride(model: string | undefined) {
    modelOverride = (model != null && model !== "") ? model : undefined;
}

function getEffectiveModel(): string {
    return modelOverride ?? (process.env["ANTHROPIC_MODEL"] || DEFAULT_ANTHROPIC_MODEL);
}

export function isAnthropicAvailable() {
    return getEffectiveApiKey() != null;
}

function getMcpToolsForAnthropic(): AnthropicTool[] {
    return listAllTools().map((tool) => ({
        name: tool.qualifiedName,
        description: tool.description,
        // eslint-disable-next-line camelcase -- this field name is dictated by the Anthropic API
        input_schema: (tool.inputSchema as AnthropicTool["input_schema"]) ?? {type: "object", properties: {}}
    }));
}

export async function streamAnthropicChat({messages, systemPrompt, signal, onChunk}: {
    messages: ChatMessage[],
    systemPrompt?: string,
    signal: AbortSignal,
    onChunk(text: string): void
}): Promise<string> {
    const apiKey = getEffectiveApiKey();
    if (apiKey == null)
        throw new Error("No Anthropic API key is configured");

    const client = new Anthropic({apiKey});
    const tools = getMcpToolsForAnthropic();
    const conversation: MessageParam[] = messages.map((message) => ({role: message.role, content: message.content}));

    let fullText = "";

    for (let round = 0; round <= maxToolCallRounds; round++) {
        const stream = client.messages.stream({
            model: getEffectiveModel(),
            // eslint-disable-next-line camelcase -- this field name is dictated by the Anthropic API
            max_tokens: 8192,
            messages: conversation,
            ...(systemPrompt != null && systemPrompt !== "" ? {system: systemPrompt} : {}),
            ...(tools.length > 0 ? {tools} : {})
        }, {signal});

        stream.on("text", (delta) => {
            fullText += delta;
            onChunk(delta);
        });

        const message = await stream.finalMessage();

        if (message.stop_reason !== "tool_use")
            return fullText;

        const toolUseBlocks = message.content.filter((block) => block.type === "tool_use");
        if (toolUseBlocks.length === 0)
            return fullText;

        conversation.push({role: "assistant", content: message.content});

        const toolResults: Extract<MessageParam["content"], unknown[]> = [];
        for (const block of toolUseBlocks) {
            let resultText: string;
            let isError = false;
            try {
                resultText = await callTool(block.name, (block.input as Record<string, unknown>) ?? {});
            } catch (err) {
                resultText = err instanceof Error ? err.message : String(err);
                isError = true;
            }

            /* eslint-disable camelcase -- these field names are dictated by the Anthropic API */
            toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: resultText,
                is_error: isError
            });
            /* eslint-enable camelcase */
        }
        conversation.push({role: "user", content: toolResults});
    }

    return fullText;
}
