import OpenAI from "openai";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

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

export async function streamOpenAiChat({messages, signal, onChunk}: {
    messages: OpenAiChatMessage[],
    signal: AbortSignal,
    onChunk(text: string): void
}): Promise<string> {
    const apiKey = getEffectiveApiKey();
    if (apiKey == null)
        throw new Error("No OpenAI API key is configured");

    const client = new OpenAI({apiKey});
    const stream = await client.chat.completions.create({
        model: getEffectiveModel(),
        messages,
        stream: true
    }, {signal});

    let fullText = "";
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta !== "") {
            fullText += delta;
            onChunk(delta);
        }
    }

    return fullText;
}
