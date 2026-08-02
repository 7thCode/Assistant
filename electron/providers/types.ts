import {isChatModelResponseSegment, type ChatHistoryItem} from "node-llama-cpp";

/** The plain role/content shape every cloud provider's chat API expects. */
export type ChatMessage = {
    role: "user" | "assistant",
    content: string
};

/** Convert node-llama-cpp's chat history format into the plain role/content format every cloud provider expects. */
export function toProviderMessages(history: readonly ChatHistoryItem[]): ChatMessage[] {
    return history.flatMap((item): ChatMessage[] => {
        if (item.type === "user")
            return [{role: "user", content: item.text}];
        else if (item.type === "model") {
            const content = item.response
                .filter((part) => (typeof part === "string" || isChatModelResponseSegment(part)))
                .map((part) => (typeof part === "string" ? part : part.text))
                .join("");

            return content === ""
                ? []
                : [{role: "assistant", content}];
        }

        // system messages aren't forwarded: no system prompt is configured in this app yet
        return [];
    });
}
