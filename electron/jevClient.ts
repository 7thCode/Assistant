import {choice, TypeSafeClient} from "@typesafe-ai/sdk";

/** Set from a Keychain-stored key at startup, or updated live from the settings UI. Takes priority over TYPESAFE_API_KEY. */
let apiKeyOverride: string | undefined;
let client: TypeSafeClient | undefined;

export function setJevApiKeyOverride(key: string | undefined) {
    apiKeyOverride = (key != null && key !== "") ? key : undefined;
    client = undefined;
}

function getEffectiveApiKey(): string | undefined {
    return apiKeyOverride ?? (process.env["TYPESAFE_API_KEY"] || undefined);
}

export function isJevAvailable() {
    return getEffectiveApiKey() != null;
}

function getClient(): TypeSafeClient | undefined {
    const apiKey = getEffectiveApiKey();
    if (apiKey == null)
        return undefined;

    // Routing sits on the critical path of every prompt, so fail fast (the caller falls back to local triage)
    // instead of using the SDK's 10s timeout with retries.
    client ??= new TypeSafeClient({apiKey, timeout: 4000, retry: {maxRetries: 0}});
    return client;
}

/** The local model must be at least this likely to be the right choice for the prompt to stay local. */
const localProbabilityThreshold = 0.7;

export type JevRouteJudgment = {
    useLocal: boolean,
    localProbability: number,
    confidence: number
};

/**
 * Asks Jev whether a small local model can answer `text` reliably. Only `text` (the message as the user typed
 * it, without injected RAG/Skill context) leaves the machine.
 *
 * Throws if Jev is unavailable (no key, network failure, timeout, API error); the caller is expected to fall back.
 */
export async function judgeWithJev(text: string, signal?: AbortSignal): Promise<JevRouteJudgment> {
    const activeClient = getClient();
    if (activeClient == null)
        throw new Error("TypeSafe API key is not configured");

    const {answers} = await activeClient.systemOne({
        state: {userMessage: text},
        questions: {
            route: choice(
                "A small local language model (a few billion parameters) and a larger cloud model are available. " +
                "Which one should answer the user's message so that the answer is accurate?",
                {
                    local: "Greetings, small talk, simple common-knowledge questions, and basic tasks needing no " +
                        "specialized knowledge, such as short rewrites or simple translations.",
                    cloud: "Named entities or jargon a small model may not know, recent events or current dates, " +
                        "precise factual recall, complex multi-step reasoning, long-form writing, or code."
                }
            )
        }
    }, {signal});

    const localProbability = answers.route.probabilities.local;
    return {
        useLocal: answers.route.choice === "local" && localProbability >= localProbabilityThreshold,
        localProbability,
        confidence: answers.route.confidence
    };
}
