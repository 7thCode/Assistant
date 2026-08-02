import path from "node:path";
import {
    getLlama, Llama, LlamaChatSession, LlamaChatSessionPromptCompletionEngine, LlamaContext, LlamaContextSequence, LlamaModel,
    isChatModelResponseSegment, type ChatModelSegmentType, type ChatHistoryItem
} from "node-llama-cpp";
import {withLock, State} from "lifecycle-utils";
import packageJson from "../../package.json";
import {getModelFunctions} from "../llm/modelFunctions.js";
import {
    DEFAULT_OPENAI_MODEL, isOpenAiAvailable, setApiKeyOverride, setModelOverride, streamOpenAiChat, type OpenAiChatMessage
} from "../providers/openaiProvider.js";
import {decideProvider} from "../router.js";
import {getStoredOpenAiApiKey, setStoredOpenAiApiKey} from "../secretStore.js";
import {
    getConfiguredActiveSessionId, getConfiguredChatModelPath, getConfiguredEmbeddingModelPath, getConfiguredLocalContextSize,
    getConfiguredLocalTemperature, getConfiguredMcpServers, getConfiguredModelDirectory, getConfiguredOpenAiModel,
    setConfiguredActiveSessionId, setConfiguredChatModelPath, setConfiguredEmbeddingModelPath, setConfiguredLocalContextSize,
    setConfiguredLocalTemperature, setConfiguredMcpServers, setConfiguredModelDirectory, setConfiguredOpenAiModel
} from "../settings.js";
import {connectServer, disconnectServer, getConnectionError, isServerConnected, listAllTools} from "../mcp/mcpClient.js";
import {
    createEmptySession, deriveSessionTitle, deleteSessionFile, generateSessionId, listSessionSummaries, readSession, writeSession,
    type SessionSummary
} from "../sessions.js";

export type {SessionSummary};
import {
    embedQuery, getLoadedEmbeddingModelName, isEmbeddingModelLoaded, loadEmbeddingModel
} from "../rag/embeddingModel.js";
import {ingestFile} from "../rag/ingest.js";
import {
    clearCollection, deleteDocument, getDocumentCount, isReachable as isQdrantReachable, listDocuments, search as searchQdrant,
    type DocumentSummary
} from "../rag/qdrantClient.js";

// no safeStorage constraint here, unlike the API key, so this can be loaded at module init time
setModelOverride(getConfiguredOpenAiModel());

export const llmState = new State<LlmState>({
    appVersion: packageJson.version,
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
            available: isOpenAiAvailable()
        }
    },
    modelDirectory: getConfiguredModelDirectory(),
    savedModelPath: getConfiguredChatModelPath(),
    savedEmbeddingModelPath: getConfiguredEmbeddingModelPath(),
    openAiModel: getConfiguredOpenAiModel(),
    openAiDefaultModel: DEFAULT_OPENAI_MODEL,
    localTemperature: getConfiguredLocalTemperature(),
    localContextSize: getConfiguredLocalContextSize(),
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
    sessions: {
        list: listSessionSummaries(),
        activeSessionId: getConfiguredActiveSessionId()
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

export type LlmState = {
    appVersion?: string,
    llama: {
        loaded: boolean,
        error?: string
    },
    selectedModelFilePath?: string,
    model: {
        loaded: boolean,
        loadProgress?: number,
        name?: string,
        error?: string
    },
    context: {
        loaded: boolean,
        error?: string
    },
    contextSequence: {
        loaded: boolean,
        error?: string
    },
    activeProvider: ProviderId,
    providers: {
        openai: {
            available: boolean
        }
    },
    modelDirectory?: string,
    /** The selected local chat model file, persisted across restarts; loaded only when `loadSavedModel` is called. */
    savedModelPath?: string,
    /** The selected RAG embedding model file, persisted across restarts; loaded only when `loadSavedEmbeddingModel` is called. */
    savedEmbeddingModelPath?: string,
    /** The user-configured OpenAI model ID override, if any. When unset, `openAiDefaultModel` is used. */
    openAiModel?: string,
    openAiDefaultModel: string,
    /** Sampling temperature used for local model prompts. `0` is deterministic/greedy. */
    localTemperature: number,
    /** Context size to use the next time the local model is loaded. `undefined` lets node-llama-cpp pick automatically. */
    localContextSize?: number,
    mcp: {
        servers: McpServerStatus[]
    },
    ragEnabled: boolean,
    rag: {
        available: boolean,
        documentCount: number,
        documents: DocumentSummary[],
        embeddingModelLoaded: boolean,
        embeddingModelName?: string
    },
    sessions: {
        list: SessionSummary[],
        activeSessionId?: string
    },
    chatSession: {
        loaded: boolean,
        generatingResult: boolean,
        simplifiedChat: SimplifiedChatItem[],
        draftPrompt: {
            prompt: string,
            completion: string
        }
    }
};

export type McpServerStatus = {
    name: string,
    command: string,
    args: string[],
    enabled: boolean,
    connected: boolean,
    error?: string,
    toolCount: number
};

export type ProviderId = "local" | "openai" | "auto";
/** The provider that actually ends up handling a turn (`"auto"` always resolves to one of these before execution) */
export type ExecutedProviderId = "local" | "openai";

export type SimplifiedChatItem = SimplifiedUserChatItem | SimplifiedModelChatItem;
export type SimplifiedUserChatItem = {
    type: "user",
    message: string,
    /** The RAG context that was silently injected ahead of this message before it was sent to the model, if any. */
    ragContext?: string
};
export type SimplifiedModelChatItem = {
    type: "model",
    producedBy: ExecutedProviderId,
    routingReason?: string,
    message: Array<{
        type: "text",
        text: string
    } | {
        type: "segment",
        segmentType: ChatModelSegmentType,
        text: string,
        startTime?: string,
        endTime?: string
    }>
};

let llama: Llama | null = null;
let model: LlamaModel | null = null;
let context: LlamaContext | null = null;
let contextSequence: LlamaContextSequence | null = null;

let chatSession: LlamaChatSession | null = null;
let chatSessionCompletionEngine: LlamaChatSessionPromptCompletionEngine | null = null;
let promptAbortController: AbortController | null = null;
let inProgressResponse: SimplifiedModelChatItem["message"] = [];

/** Tracks which provider produced each "model" turn in `chatSession`'s history, in order. */
let modelTurnProviders: ExecutedProviderId[] = [];
/** Tracks the router's reason (if any) for each "model" turn, parallel to `modelTurnProviders`. */
let modelTurnRoutingReasons: Array<string | undefined> = [];
/** The provider handling the turn currently being generated, for the in-progress placeholder message. */
let inProgressProvider: ExecutedProviderId = "local";
let inProgressRoutingReason: string | undefined;

/**
 * Tracks the text to display for each "user" turn in `chatSession`'s history, in order.
 * This is the message as the user typed it, without the RAG context that may have been silently
 * prepended before it was actually sent to the model (`chatSession`'s own history holds that full text).
 */
let userTurnDisplayMessages: string[] = [];
/** Tracks the RAG context (if any) injected ahead of each user turn, parallel to `userTurnDisplayMessages`. */
let userTurnRagContexts: Array<string | undefined> = [];
/** The RAG context (if any) for the turn currently being generated, for the in-progress placeholder message. */
let inProgressRagContext: string | undefined;

/** The session currently loaded into `chatSession`, persisted to disk under this id. */
let activeSessionId: string | undefined;

/**
 * Assigns a fresh session id to the already-empty `chatSession` (used right after it's first created), without
 * resetting it again. Assumes the chatSession lock is held.
 */
function assignNewSessionIdToCurrentEmptyChatSession() {
    const id = generateSessionId();
    writeSession(createEmptySession(id));
    activeSessionId = id;
    setConfiguredActiveSessionId(id);

    llmState.state = {
        ...llmState.state,
        sessions: {
            list: listSessionSummaries(),
            activeSessionId: id
        }
    };
}

/** Creates a brand new empty session, makes it active, and resets `chatSession` to match. Assumes the chatSession lock is held. */
function doCreateNewSession() {
    const id = generateSessionId();
    writeSession(createEmptySession(id));
    activeSessionId = id;
    setConfiguredActiveSessionId(id);

    llmFunctions.chatSession.resetChatHistory(true);

    llmState.state = {
        ...llmState.state,
        sessions: {
            list: listSessionSummaries(),
            activeSessionId: id
        }
    };
}

/** Loads a previously saved session into `chatSession` and makes it active. Assumes the chatSession lock is held. */
function doSwitchSession(id: string) {
    if (chatSession == null)
        throw new Error("Chat session not loaded");

    const data = readSession(id);
    if (data == null)
        throw new Error(`Session "${id}" not found`);

    chatSession.setChatHistory(data.chatHistory);
    modelTurnProviders = [...data.modelTurnProviders];
    modelTurnRoutingReasons = [...data.modelTurnRoutingReasons];
    userTurnDisplayMessages = [...data.userTurnDisplayMessages];
    userTurnRagContexts = [...data.userTurnRagContexts];
    activeSessionId = id;
    setConfiguredActiveSessionId(id);

    llmState.state = {
        ...llmState.state,
        sessions: {
            list: listSessionSummaries(),
            activeSessionId: id
        },
        chatSession: {
            ...llmState.state.chatSession,
            simplifiedChat: getSimplifiedChatHistory(false)
        }
    };
}

/**
 * Updates (or inserts) a single session's summary in `llmState.state.sessions.list`, in place, without
 * rescanning every session file on disk. Keeps the list sorted by `updatedAt` descending, like `listSessionSummaries`.
 */
function upsertSessionSummaryInState(summary: SessionSummary) {
    const list = [summary, ...llmState.state.sessions.list.filter((existing) => existing.id !== summary.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    llmState.state = {
        ...llmState.state,
        sessions: {
            ...llmState.state.sessions,
            list
        }
    };
}

/** Persists the currently active session's chat content to disk. Call after every completed turn. */
function writeCurrentSessionSnapshot() {
    if (activeSessionId == null || chatSession == null)
        return;

    const existing = readSession(activeSessionId);
    const firstUserMessage = userTurnDisplayMessages[0];
    const title = (existing != null && existing.title !== "New chat")
        ? existing.title
        : (firstUserMessage != null ? deriveSessionTitle(firstUserMessage) : "New chat");
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();

    writeSession({
        id: activeSessionId,
        title,
        createdAt,
        updatedAt,
        chatHistory: chatSession.getChatHistory(),
        modelTurnProviders: [...modelTurnProviders],
        modelTurnRoutingReasons: [...modelTurnRoutingReasons],
        userTurnDisplayMessages: [...userTurnDisplayMessages],
        userTurnRagContexts: [...userTurnRagContexts]
    });

    upsertSessionSummaryInState({id: activeSessionId, title, createdAt, updatedAt});
}

export const llmFunctions = {
    async loadLlama() {
        await withLock([llmFunctions, "llama"], async () => {
            if (llama != null) {
                try {
                    await llama.dispose();
                    llama = null;
                } catch (err) {
                    console.error("Failed to dispose llama", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    llama: {loaded: false}
                };

                llama = await getLlama();
                llmState.state = {
                    ...llmState.state,
                    llama: {loaded: true}
                };

                llama.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        llama: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to load llama", err);
                llmState.state = {
                    ...llmState.state,
                    llama: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async loadModel(modelPath: string) {
        await withLock([llmFunctions, "model"], async () => {
            if (llama == null)
                throw new Error("Llama not loaded");

            if (model != null) {
                try {
                    await model.dispose();
                    model = null;
                } catch (err) {
                    console.error("Failed to dispose model", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: false,
                        loadProgress: 0
                    }
                };

                model = await llama.loadModel({
                    modelPath,
                    onLoadProgress(loadProgress: number) {
                        llmState.state = {
                            ...llmState.state,
                            model: {
                                ...llmState.state.model,
                                loadProgress
                            }
                        };
                    }
                });
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: true,
                        loadProgress: 1,
                        name: path.basename(modelPath)
                    }
                };

                model.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        model: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to load model", err);
                llmState.state = {
                    ...llmState.state,
                    model: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async createContext() {
        await withLock([llmFunctions, "context"], async () => {
            if (model == null)
                throw new Error("Model not loaded");

            if (context != null) {
                try {
                    await context.dispose();
                    context = null;
                } catch (err) {
                    console.error("Failed to dispose context", err);
                }
            }

            try {
                llmState.state = {
                    ...llmState.state,
                    context: {loaded: false}
                };

                context = await model.createContext(
                    llmState.state.localContextSize != null
                        ? {contextSize: llmState.state.localContextSize}
                        : {}
                );
                llmState.state = {
                    ...llmState.state,
                    context: {loaded: true}
                };

                context.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        context: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to create context", err);
                llmState.state = {
                    ...llmState.state,
                    context: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    async createContextSequence() {
        await withLock([llmFunctions, "contextSequence"], async () => {
            if (context == null)
                throw new Error("Context not loaded");

            try {
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {loaded: false}
                };

                contextSequence = context.getSequence();
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {loaded: true}
                };

                contextSequence.onDispose.createListener(() => {
                    llmState.state = {
                        ...llmState.state,
                        contextSequence: {loaded: false}
                    };
                });
            } catch (err) {
                console.error("Failed to get context sequence", err);
                llmState.state = {
                    ...llmState.state,
                    contextSequence: {
                        loaded: false,
                        error: String(err)
                    }
                };
            }
        });
    },
    setActiveProvider(provider: ProviderId) {
        llmState.state = {
            ...llmState.state,
            activeProvider: provider
        };
    },
    /** `safeStorage` is only usable after the app's `ready` event, so this must be called from there, not at module load time. */
    loadStoredOpenAiApiKey() {
        const storedKey = getStoredOpenAiApiKey();
        if (storedKey != null)
            setApiKeyOverride(storedKey);

        llmState.state = {
            ...llmState.state,
            providers: {
                openai: {available: isOpenAiAvailable()}
            }
        };
    },
    /** Pass an empty string to remove the stored key. */
    setOpenAiApiKey(key: string) {
        setStoredOpenAiApiKey(key);
        setApiKeyOverride(key);
        llmState.state = {
            ...llmState.state,
            providers: {
                openai: {available: isOpenAiAvailable()}
            }
        };
    },
    clearOpenAiApiKey() {
        llmFunctions.setOpenAiApiKey("");
    },
    /** Pass an empty string to reset to `openAiDefaultModel`. */
    setOpenAiModel(model: string) {
        setConfiguredOpenAiModel(model);
        setModelOverride(model);
        llmState.state = {
            ...llmState.state,
            openAiModel: model === "" ? undefined : model
        };
    },
    setModelDirectory(dirPath: string) {
        setConfiguredModelDirectory(dirPath);
        llmState.state = {
            ...llmState.state,
            modelDirectory: dirPath
        };
    },
    /** Takes effect on the very next prompt; no reload needed. */
    setLocalTemperature(temperature: number) {
        setConfiguredLocalTemperature(temperature);
        llmState.state = {
            ...llmState.state,
            localTemperature: temperature
        };
    },
    /** Takes effect the next time the local model is loaded. Pass `undefined` to reset to automatic sizing. */
    setLocalContextSize(contextSize: number | undefined) {
        setConfiguredLocalContextSize(contextSize);
        llmState.state = {
            ...llmState.state,
            localContextSize: contextSize
        };
    },
    setSavedModelPath(modelPath: string) {
        setConfiguredChatModelPath(modelPath);
        llmState.state = {
            ...llmState.state,
            savedModelPath: modelPath
        };
    },
    async loadSavedModel() {
        const modelPath = llmState.state.savedModelPath;
        if (modelPath == null)
            throw new Error("No model file selected");

        llmState.state = {
            ...llmState.state,
            selectedModelFilePath: modelPath,
            chatSession: {
                loaded: false,
                generatingResult: false,
                simplifiedChat: [],
                draftPrompt: {
                    prompt: llmState.state.chatSession.draftPrompt.prompt,
                    completion: ""
                }
            }
        };

        if (!llmState.state.llama.loaded)
            await llmFunctions.loadLlama();

        await llmFunctions.loadModel(modelPath);
        await llmFunctions.createContext();
        await llmFunctions.createContextSequence();
        await llmFunctions.chatSession.createChatSession();
    },
    setSavedEmbeddingModelPath(modelPath: string) {
        setConfiguredEmbeddingModelPath(modelPath);
        llmState.state = {
            ...llmState.state,
            savedEmbeddingModelPath: modelPath
        };
    },
    async loadSavedEmbeddingModel() {
        const modelPath = llmState.state.savedEmbeddingModelPath;
        if (modelPath == null)
            throw new Error("No embedding model file selected");

        await llmFunctions.loadEmbeddingModelFile(modelPath);
    },
    refreshMcpState() {
        const persistedServers = getConfiguredMcpServers();
        const connectedTools = listAllTools();

        llmState.state = {
            ...llmState.state,
            mcp: {
                servers: persistedServers.map((server): McpServerStatus => ({
                    name: server.name,
                    command: server.command,
                    args: server.args,
                    enabled: server.enabled,
                    connected: isServerConnected(server.name),
                    error: getConnectionError(server.name),
                    toolCount: connectedTools.filter((tool) => tool.serverName === server.name).length
                }))
            }
        };
    },
    /** Connects every MCP server that's persisted as enabled. Meant to be called once at app startup. */
    async connectConfiguredMcpServers() {
        const servers = getConfiguredMcpServers().filter((server) => server.enabled);

        await Promise.all(servers.map(async (server) => {
            try {
                await connectServer(server);
            } catch (err) {
                console.error(`Failed to connect to MCP server "${server.name}"`, err);
            }
        }));

        llmFunctions.refreshMcpState();
    },
    async addMcpServer(config: {name: string, command: string, args: string[]}) {
        const servers = getConfiguredMcpServers();
        if (servers.some((server) => server.name === config.name))
            throw new Error(`An MCP server named "${config.name}" already exists`);

        setConfiguredMcpServers([...servers, {...config, enabled: true}]);
        llmFunctions.refreshMcpState();

        try {
            await connectServer(config);
        } catch (err) {
            console.error(`Failed to connect to MCP server "${config.name}"`, err);
        }

        llmFunctions.refreshMcpState();
    },
    async removeMcpServer(name: string) {
        await disconnectServer(name);
        setConfiguredMcpServers(getConfiguredMcpServers().filter((server) => server.name !== name));
        llmFunctions.refreshMcpState();
    },
    async setMcpServerEnabled(name: string, enabled: boolean) {
        const servers = getConfiguredMcpServers();
        const server = servers.find((candidate) => candidate.name === name);
        if (server == null)
            return;

        setConfiguredMcpServers(servers.map((candidate) => (candidate.name === name ? {...candidate, enabled} : candidate)));

        if (enabled) {
            try {
                await connectServer(server);
            } catch (err) {
                console.error(`Failed to connect to MCP server "${name}"`, err);
            }
        } else {
            await disconnectServer(name);
        }

        llmFunctions.refreshMcpState();
    },
    setRagEnabled(enabled: boolean) {
        llmState.state = {
            ...llmState.state,
            ragEnabled: enabled
        };
    },
    async refreshRagState() {
        const [qdrantReachable, documentCount, documents] = await Promise.all([
            isQdrantReachable(),
            getDocumentCount(),
            listDocuments()
        ]);

        llmState.state = {
            ...llmState.state,
            rag: {
                available: qdrantReachable && isEmbeddingModelLoaded(),
                documentCount,
                documents,
                embeddingModelLoaded: isEmbeddingModelLoaded(),
                embeddingModelName: getLoadedEmbeddingModelName()
            }
        };
    },
    async deleteRagDocument(source: string) {
        await deleteDocument(source);
        await llmFunctions.refreshRagState();
    },
    async loadEmbeddingModelFile(modelPath: string) {
        await loadEmbeddingModel(modelPath);
        await llmFunctions.refreshRagState();
    },
    async ingestDocument(filePath: string) {
        const result = await ingestFile(filePath);
        await llmFunctions.refreshRagState();
        return result;
    },
    async clearRag() {
        await clearCollection();
        await llmFunctions.refreshRagState();
    },
    refreshSessionsList() {
        llmState.state = {
            ...llmState.state,
            sessions: {
                ...llmState.state.sessions,
                list: listSessionSummaries()
            }
        };
    },
    /** Saves the current conversation (if any) and starts a brand new, empty one. */
    async newSession() {
        await withLock([llmFunctions, "chatSession"], async () => {
            doCreateNewSession();
        });
    },
    /** Switches `chatSession` to a previously saved session. The local model must already be loaded. */
    async switchSession(id: string) {
        await withLock([llmFunctions, "chatSession"], async () => {
            doSwitchSession(id);
        });
    },
    async deleteSession(id: string) {
        await withLock([llmFunctions, "chatSession"], async () => {
            deleteSessionFile(id);
            const remaining = listSessionSummaries();

            if (activeSessionId !== id) {
                llmState.state = {
                    ...llmState.state,
                    sessions: {
                        ...llmState.state.sessions,
                        list: remaining
                    }
                };
                return;
            }

            if (remaining.length > 0)
                doSwitchSession(remaining[0]!.id);
            else
                doCreateNewSession();
        });
    },
    renameSession(id: string, title: string) {
        const data = readSession(id);
        if (data == null)
            return;

        data.title = title.trim() === "" ? "New chat" : title.trim();
        data.updatedAt = new Date().toISOString();
        writeSession(data);

        llmState.state = {
            ...llmState.state,
            sessions: {
                ...llmState.state.sessions,
                list: listSessionSummaries()
            }
        };
    },
    chatSession: {
        async createChatSession() {
            await withLock([llmFunctions, "chatSession"], async () => {
                if (contextSequence == null)
                    throw new Error("Context sequence not loaded");

                if (chatSession != null) {
                    try {
                        chatSession.dispose();
                        chatSession = null;
                        chatSessionCompletionEngine = null;
                    } catch (err) {
                        console.error("Failed to dispose chat session", err);
                    }
                }

                try {
                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            loaded: false,
                            generatingResult: false,
                            simplifiedChat: [],
                            draftPrompt: llmState.state.chatSession.draftPrompt
                        }
                    };

                    llmFunctions.chatSession.resetChatHistory(false);

                    try {
                        await chatSession?.preloadPrompt("", {
                            functions: getModelFunctions(), // these won't be called, but are used to avoid redundant context shifts
                            signal: promptAbortController?.signal
                        });
                    } catch (err) {
                        // do nothing
                    }
                    chatSessionCompletionEngine?.complete(llmState.state.chatSession.draftPrompt.prompt);

                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            ...llmState.state.chatSession,
                            loaded: true
                        }
                    };

                    // resume the previously active session (or the most recently used one), if any exist on disk
                    const summaries = listSessionSummaries();
                    const lastActiveId = activeSessionId ?? getConfiguredActiveSessionId();
                    if (lastActiveId != null && summaries.some((summary) => summary.id === lastActiveId))
                        doSwitchSession(lastActiveId);
                    else if (summaries.length > 0)
                        doSwitchSession(summaries[0]!.id);
                    else
                        assignNewSessionIdToCurrentEmptyChatSession();
                } catch (err) {
                    console.error("Failed to create chat session", err);
                    llmState.state = {
                        ...llmState.state,
                        chatSession: {
                            loaded: false,
                            generatingResult: false,
                            simplifiedChat: [],
                            draftPrompt: llmState.state.chatSession.draftPrompt
                        }
                    };
                }
            });
        },
        async prompt(rawMessage: string) {
            await withLock([llmFunctions, "chatSession"], async () => {
                if (chatSession == null)
                    throw new Error("Chat session not loaded");
                if (llama == null)
                    throw new Error("Llama not loaded");

                let overrideProvider: ExecutedProviderId | null = null;
                let displayMessage = rawMessage;
                if (/^\/local\s+/i.test(displayMessage)) {
                    overrideProvider = "local";
                    displayMessage = displayMessage.replace(/^\/local\s+/i, "");
                } else if (/^\/cloud\s+/i.test(displayMessage)) {
                    overrideProvider = "openai";
                    displayMessage = displayMessage.replace(/^\/cloud\s+/i, "");
                }

                // `message` is what actually gets sent to the model; it may be augmented with RAG context below.
                // `displayMessage` is what the user sees in the chat, and never includes that injected context.
                let message = displayMessage;
                let ragContext: string | undefined;

                if (llmState.state.ragEnabled && llmState.state.rag.available) {
                    try {
                        const queryVector = await embedQuery(displayMessage);
                        const retrieved = await searchQdrant(queryVector, 4, 0.75);

                        if (retrieved.length > 0) {
                            ragContext = retrieved
                                .map((chunk) => `- (${chunk.source}) ${chunk.text}`)
                                .join("\n\n");
                            message = `[参考情報]\n${ragContext}\n\n[質問]\n${displayMessage}`;
                        }
                    } catch (err) {
                        console.error("RAG retrieval failed, continuing without it", err);
                    }
                }

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        generatingResult: true,
                        draftPrompt: {
                            prompt: "",
                            completion: ""
                        }
                    }
                };
                promptAbortController = new AbortController();
                inProgressRagContext = ragContext;

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        simplifiedChat: getSimplifiedChatHistory(true, displayMessage)
                    }
                };

                const abortSignal = promptAbortController.signal;

                const routeDecision = overrideProvider != null
                    ? {provider: overrideProvider, reason: "Manual override (/local or /cloud)"}
                    : llmState.state.activeProvider === "auto"
                        ? await decideProvider(llama, chatSession, message)
                        : {provider: llmState.state.activeProvider, reason: undefined};
                const provider = routeDecision.provider;
                inProgressProvider = provider;
                inProgressRoutingReason = routeDecision.reason;
                userTurnDisplayMessages.push(displayMessage);
                userTurnRagContexts.push(ragContext);

                if (provider === "openai") {
                    let fullText = "";
                    try {
                        await streamOpenAiChat({
                            messages: [
                                ...toOpenAiMessages(chatSession.getChatHistory()),
                                {role: "user", content: message}
                            ],
                            signal: abortSignal,
                            onChunk(delta) {
                                fullText += delta;
                                inProgressResponse = squashMessageIntoModelChatMessages(inProgressResponse, {
                                    type: "text",
                                    text: delta
                                });

                                llmState.state = {
                                    ...llmState.state,
                                    chatSession: {
                                        ...llmState.state.chatSession,
                                        simplifiedChat: getSimplifiedChatHistory(true, displayMessage)
                                    }
                                };
                            }
                        });
                    } catch (err) {
                        if (err !== abortSignal.reason)
                            throw err;

                        // if the prompt was aborted before the generation even started, we ignore the error
                    }

                    // write the OpenAI exchange back into the local chat session's history, so that
                    // switching back to the local provider continues from the same context
                    chatSession.setChatHistory([
                        ...chatSession.getChatHistory(),
                        {type: "user", text: message},
                        {type: "model", response: [fullText]}
                    ]);
                    modelTurnProviders.push("openai");
                    modelTurnRoutingReasons.push(routeDecision.reason);
                } else {
                    try {
                        await chatSession.prompt(message, {
                            signal: abortSignal,
                            stopOnAbortSignal: true,
                            temperature: llmState.state.localTemperature,
                            functions: getModelFunctions(),
                            onResponseChunk(chunk) {
                                inProgressResponse = squashMessageIntoModelChatMessages(
                                    inProgressResponse,
                                    (chunk.type == null || chunk.segmentType == null)
                                        ? {
                                            type: "text",
                                            text: chunk.text
                                        }
                                        : {
                                            type: "segment",
                                            segmentType: chunk.segmentType,
                                            text: chunk.text,
                                            startTime: chunk.segmentStartTime?.toISOString(),
                                            endTime: chunk.segmentEndTime?.toISOString()
                                        }
                                );

                                llmState.state = {
                                    ...llmState.state,
                                    chatSession: {
                                        ...llmState.state.chatSession,
                                        simplifiedChat: getSimplifiedChatHistory(true, displayMessage)
                                    }
                                };
                            }
                        });
                    } catch (err) {
                        if (err !== abortSignal.reason)
                            throw err;

                        // if the prompt was aborted before the generation even started, we ignore the error
                    }
                    modelTurnProviders.push("local");
                    modelTurnRoutingReasons.push(routeDecision.reason);
                }

                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        ...llmState.state.chatSession,
                        generatingResult: false,
                        simplifiedChat: getSimplifiedChatHistory(false),
                        draftPrompt: {
                            ...llmState.state.chatSession.draftPrompt,
                            completion:
                                chatSessionCompletionEngine?.complete(llmState.state.chatSession.draftPrompt.prompt)?.trimStart() ?? ""
                        }
                    }
                };
                inProgressResponse = [];
                writeCurrentSessionSnapshot();
            });
        },
        stopActivePrompt() {
            promptAbortController?.abort();
        },
        resetChatHistory(markAsLoaded: boolean = true) {
            if (contextSequence == null)
                return;

            modelTurnProviders = [];
            modelTurnRoutingReasons = [];
            userTurnDisplayMessages = [];
            userTurnRagContexts = [];
            chatSession?.dispose();
            chatSession = new LlamaChatSession({
                contextSequence,
                autoDisposeSequence: false
            });
            chatSessionCompletionEngine = chatSession.createPromptCompletionEngine({
                functions: getModelFunctions(), // these won't be called, but are used to avoid redundant context shifts
                onGeneration(prompt, completion) {
                    if (llmState.state.chatSession.draftPrompt.prompt === prompt) {
                        llmState.state = {
                            ...llmState.state,
                            chatSession: {
                                ...llmState.state.chatSession,
                                draftPrompt: {
                                    prompt,
                                    completion: completion.trimStart()
                                }
                            }
                        };
                    }
                }
            });

            llmState.state = {
                ...llmState.state,
                chatSession: {
                    loaded: markAsLoaded
                        ? true
                        : llmState.state.chatSession.loaded,
                    generatingResult: false,
                    simplifiedChat: [],
                    draftPrompt: {
                        prompt: llmState.state.chatSession.draftPrompt.prompt,
                        completion: chatSessionCompletionEngine.complete(llmState.state.chatSession.draftPrompt.prompt)?.trimStart() ?? ""
                    }
                }
            };

            chatSession.onDispose.createListener(() => {
                chatSessionCompletionEngine = null;
                promptAbortController = null;
                llmState.state = {
                    ...llmState.state,
                    chatSession: {
                        loaded: false,
                        generatingResult: false,
                        simplifiedChat: [],
                        draftPrompt: llmState.state.chatSession.draftPrompt
                    }
                };
            });
        },
        setDraftPrompt(prompt: string) {
            if (chatSessionCompletionEngine == null)
                return;

            llmState.state = {
                ...llmState.state,
                chatSession: {
                    ...llmState.state.chatSession,
                    draftPrompt: {
                        prompt: prompt,
                        completion: chatSessionCompletionEngine.complete(prompt)?.trimStart() ?? ""
                    }
                }
            };
        }
    }
} as const;

function getSimplifiedChatHistory(generatingResult: boolean, currentPrompt?: string) {
    if (chatSession == null)
        return [];

    let modelTurnIndex = 0;
    let userTurnIndex = 0;
    const chatHistory: SimplifiedChatItem[] = chatSession.getChatHistory()
        .flatMap((item): SimplifiedChatItem[] => {
            if (item.type === "system")
                return [];
            else if (item.type === "user") {
                const turnIndex = userTurnIndex++;
                return [{
                    type: "user",
                    message: userTurnDisplayMessages[turnIndex] ?? item.text,
                    ragContext: userTurnRagContexts[turnIndex]
                }];
            } else if (item.type === "model") {
                const turnIndex = modelTurnIndex++;
                return [{
                    type: "model",
                    producedBy: modelTurnProviders[turnIndex] ?? "local",
                    routingReason: modelTurnRoutingReasons[turnIndex],
                    message: item.response
                        .filter((item) => (typeof item === "string" || isChatModelResponseSegment(item)))
                        .map((item): SimplifiedModelChatItem["message"][number] | null => {
                            if (typeof item === "string")
                                return {
                                    type: "text",
                                    text: item
                                };
                            else if (isChatModelResponseSegment(item))
                                return {
                                    type: "segment",
                                    segmentType: item.segmentType,
                                    text: item.text,
                                    startTime: item.startTime,
                                    endTime: item.endTime
                                };

                            void (item satisfies never); // ensure all item types are handled
                            return null;
                        })
                        .filter((item) => item != null)

                        // squash adjacent response items of the same type
                        .reduce((res, item) => {
                            return squashMessageIntoModelChatMessages(res, item);
                        }, [] as SimplifiedModelChatItem["message"])
                }];
            }

            void (item satisfies never); // ensure all item types are handled
            return [];
        });

    if (generatingResult && currentPrompt != null) {
        chatHistory.push({
            type: "user",
            message: currentPrompt,
            ragContext: inProgressRagContext
        });

        if (inProgressResponse.length > 0)
            chatHistory.push({
                type: "model",
                producedBy: inProgressProvider,
                routingReason: inProgressRoutingReason,
                message: inProgressResponse
            });
    }

    return chatHistory;
}

/** Convert node-llama-cpp's chat history format into the plain role/content format the OpenAI API expects */
function toOpenAiMessages(history: readonly ChatHistoryItem[]): OpenAiChatMessage[] {
    return history.flatMap((item): OpenAiChatMessage[] => {
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

/** Squash a new model response message into the existing model response messages array */
function squashMessageIntoModelChatMessages(
    modelChatMessages: SimplifiedModelChatItem["message"],
    message: SimplifiedModelChatItem["message"][number]
): SimplifiedModelChatItem["message"] {
    const newModelChatMessages = structuredClone(modelChatMessages);
    const lastExistingModelMessage = newModelChatMessages.at(-1);

    if (lastExistingModelMessage == null || lastExistingModelMessage.type !== message.type) {
        // avoid pushing empty text messages
        if (message.type !== "text" || message.text !== "")
            newModelChatMessages.push(message);

        return newModelChatMessages;
    }

    if (lastExistingModelMessage.type === "text" && message.type === "text") {
        lastExistingModelMessage.text += message.text;
        return newModelChatMessages;
    } else if (
        lastExistingModelMessage.type === "segment" && message.type === "segment" &&
        lastExistingModelMessage.segmentType === message.segmentType &&
        lastExistingModelMessage.endTime == null
    ) {
        lastExistingModelMessage.text += message.text;
        lastExistingModelMessage.endTime = message.endTime;
        return newModelChatMessages;
    }

    newModelChatMessages.push(message);
    return newModelChatMessages;
}
