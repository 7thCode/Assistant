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
        },
        anthropic: {
            available: false
        },
        gemini: {
            available: false
        }
    },
    openAiDefaultModel: "",
    anthropicDefaultModel: "",
    geminiDefaultModel: "",
    localTemperature: 0,
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
    usageStats: {
        local: 0,
        openai: 0,
        anthropic: 0,
        gemini: 0
    },
    sessions: {
        list: [],
        activeSessionId: undefined
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
