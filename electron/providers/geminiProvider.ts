import {GoogleGenAI, type Content, type FunctionCall, type FunctionDeclaration, type Part} from "@google/genai";
import {callTool, listAllTools} from "../mcp/mcpClient.js";
import type {ChatMessage} from "./types.js";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** How many tool-call round-trips a single reply may take before we give up and return whatever text we have. */
const maxToolCallRounds = 5;

/** Set from a Keychain-stored key at startup, or updated live from the settings UI. Takes priority over GEMINI_API_KEY. */
let apiKeyOverride: string | undefined;

export function setGeminiApiKeyOverride(key: string | undefined) {
    apiKeyOverride = (key != null && key !== "") ? key : undefined;
}

function getEffectiveApiKey(): string | undefined {
    return apiKeyOverride ?? process.env["GEMINI_API_KEY"];
}

/** Set from a persisted setting at startup, or updated live from the settings UI. Takes priority over GEMINI_MODEL. */
let modelOverride: string | undefined;

export function setGeminiModelOverride(model: string | undefined) {
    modelOverride = (model != null && model !== "") ? model : undefined;
}

function getEffectiveModel(): string {
    return modelOverride ?? (process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL);
}

export function isGeminiAvailable() {
    return getEffectiveApiKey() != null;
}

function getMcpToolsForGemini(): Array<{functionDeclarations: FunctionDeclaration[]}> {
    const declarations = listAllTools().map((tool): FunctionDeclaration => ({
        name: tool.qualifiedName,
        description: tool.description,
        parametersJsonSchema: tool.inputSchema ?? {type: "object", properties: {}}
    }));

    return declarations.length > 0 ? [{functionDeclarations: declarations}] : [];
}

function toGeminiContents(messages: ChatMessage[]): Content[] {
    return messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{text: message.content}]
    }));
}

export async function streamGeminiChat({messages, signal, onChunk}: {
    messages: ChatMessage[],
    signal: AbortSignal,
    onChunk(text: string): void
}): Promise<string> {
    const apiKey = getEffectiveApiKey();
    if (apiKey == null)
        throw new Error("No Gemini API key is configured");

    const client = new GoogleGenAI({apiKey});
    const tools = getMcpToolsForGemini();
    const contents: Content[] = toGeminiContents(messages);

    let fullText = "";

    for (let round = 0; round <= maxToolCallRounds; round++) {
        const stream = await client.models.generateContentStream({
            model: getEffectiveModel(),
            contents,
            config: {
                abortSignal: signal,
                ...(tools.length > 0 ? {tools} : {})
            }
        });

        let roundText = "";
        const functionCalls: FunctionCall[] = [];

        for await (const chunk of stream) {
            const text = chunk.text;
            if (text != null && text !== "") {
                roundText += text;
                fullText += text;
                onChunk(text);
            }

            if (chunk.functionCalls != null)
                functionCalls.push(...chunk.functionCalls);
        }

        if (functionCalls.length === 0)
            return fullText;

        const modelParts: Part[] = [];
        if (roundText !== "")
            modelParts.push({text: roundText});
        for (const call of functionCalls)
            modelParts.push({functionCall: call});
        contents.push({role: "model", parts: modelParts});

        const responseParts: Part[] = [];
        for (const call of functionCalls) {
            let resultText: string;
            let errored = false;
            try {
                resultText = await callTool(call.name ?? "", call.args ?? {});
            } catch (err) {
                resultText = err instanceof Error ? err.message : String(err);
                errored = true;
            }

            responseParts.push({
                functionResponse: {
                    id: call.id,
                    name: call.name,
                    response: errored ? {error: resultText} : {output: resultText}
                }
            });
        }
        contents.push({role: "user", parts: responseParts});
    }

    return fullText;
}
