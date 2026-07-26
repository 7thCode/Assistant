import {Llama, LlamaChatSession, LlamaJsonSchemaGrammar} from "node-llama-cpp";
import {isOpenAiAvailable} from "./providers/openaiProvider.js";

export type RouteDecision = {
    provider: "local" | "openai",
    reason: string
};

const triageSchema = {
    type: "object",
    properties: {
        canAnswer: {type: "boolean"},
        reason: {type: "string"}
    },
    required: ["canAnswer", "reason"]
} as const;

/**
 * Asks the local model to triage whether it can answer the message on its own, or whether it should be
 * forwarded to a cloud provider. The triage exchange is rolled back from `chatSession`'s history afterward,
 * so it never becomes part of the visible conversation.
 */
export async function decideProvider(llama: Llama, chatSession: LlamaChatSession, message: string): Promise<RouteDecision> {
    if (!isOpenAiAvailable())
        return {provider: "local", reason: "OpenAI is not configured"};

    const savedHistory = chatSession.getChatHistory();
    try {
        const grammar = new LlamaJsonSchemaGrammar(llama, triageSchema);
        const triagePrompt =
            "You are a routing assistant for a small local language model. Decide whether the small local model " +
            "can answer the user's next message well on its own, without needing a larger cloud model. Prefer " +
            "answering locally unless the request needs broad world knowledge, complex reasoning, long-form " +
            "writing/code, or up-to-date information the local model likely lacks. Respond with the JSON only.\n\n" +
            `User message: ${JSON.stringify(message)}`;

        const response = await chatSession.prompt(triagePrompt, {
            grammar,
            maxTokens: 200
        });
        const result = grammar.parse(response);

        return {
            provider: result.canAnswer ? "local" : "openai",
            reason: result.reason
        };
    } catch (err) {
        console.error("Triage failed, defaulting to cloud", err);
        return {provider: "openai", reason: "Triage failed; defaulting to cloud"};
    } finally {
        chatSession.setChatHistory(savedHistory);
    }
}
