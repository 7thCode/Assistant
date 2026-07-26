import {State} from "lifecycle-utils";

import type {LlmState} from "../../electron/state/llmState.ts";

export const llmState = new State<LlmState>({
    appVersion: undefined,
    llama: {
        loaded: false
    },
    model: {
        loaded: false
    },
    context: {
        loaded: false
    },
    contextSequence: {
        loaded: false
    },
    activeProvider: "auto",
    providers: {
        openai: {
            available: false
        }
    },
    openAiDefaultModel: "",
    mcp: {
        servers: []
    },
    ragEnabled: false,
    rag: {
        available: false,
        documentCount: 0,
        documents: [],
        embeddingModelLoaded: false,
        embeddingModelName: undefined
    },
    chatSession: {
        loaded: false,
        generatingResult: false,
        simplifiedChat: [],
        draftPrompt: {
            prompt: "",
            completion: ""
        }
    }
});
