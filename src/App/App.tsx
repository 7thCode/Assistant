import {useCallback, useLayoutEffect, useRef, useState} from "react";
import classNames from "classnames";
import {llmState} from "../state/llmState.ts";
import {electronLlmRpc} from "../rpc/llmRpc.ts";
import {useExternalState} from "../hooks/useExternalState.ts";
import {SearchIconSVG} from "../icons/SearchIconSVG.tsx";
import {StarIconSVG} from "../icons/StarIconSVG.tsx";
import {DownloadIconSVG} from "../icons/DownloadIconSVG.tsx";
import {Header} from "./components/Header/Header.tsx";
import {ChatHistory} from "./components/ChatHistory/ChatHistory.tsx";
import {InputRow} from "./components/InputRow/InputRow.tsx";
import {SettingsModal} from "./components/SettingsModal/SettingsModal.tsx";
import {SessionSidebar} from "./components/SessionSidebar/SessionSidebar.tsx";

import "./App.css";
import type {LlmState} from "../../electron/state/llmState.ts";


function errorMessage(err: unknown): string {
    if (err != null && typeof err === "object" && "message" in err && typeof err.message === "string")
        return err.message;

    return String(err);
}

export function App() {
    const state = useExternalState(llmState);
    const {generatingResult} = state.chatSession;
    const isScrollAnchoredRef = useRef(false);
    const lastAnchorScrollTopRef = useRef<number>(0);

    const isScrolledToTheBottom = useCallback(() => {
        return (
            document.documentElement.scrollHeight - document.documentElement.scrollTop - 1
        ) <= document.documentElement.clientHeight;
    }, []);

    const scrollToBottom = useCallback(() => {
        const newScrollTop = document.documentElement.scrollHeight - document.documentElement.clientHeight;

        if (newScrollTop > document.documentElement.scrollTop && newScrollTop > lastAnchorScrollTopRef.current) {
            document.documentElement.scrollTo({
                top: newScrollTop,
                behavior: "smooth"
            });
            lastAnchorScrollTopRef.current = document.documentElement.scrollTop;
        }

        isScrollAnchoredRef.current = true;
    }, []);

    useLayoutEffect(() => {
        // anchor scroll to bottom

        function onScroll() {
            const currentScrollTop = document.documentElement.scrollTop;

            isScrollAnchoredRef.current = isScrolledToTheBottom() ||
                currentScrollTop >= lastAnchorScrollTopRef.current;

            // handle scroll animation
            if (isScrollAnchoredRef.current)
                lastAnchorScrollTopRef.current = currentScrollTop;
        }

        const observer = new ResizeObserver(() => {
            if (isScrollAnchoredRef.current && !isScrolledToTheBottom())
                scrollToBottom();
        });

        window.addEventListener("scroll", onScroll, {passive: false});
        observer.observe(document.body, {
            box: "border-box"
        });
        scrollToBottom();

        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    const selectModelFile = useCallback(async () => {
        await electronLlmRpc.selectModelFile();
    }, []);
    const loadSelectedModel = useCallback(async () => {
        await electronLlmRpc.loadSelectedModel();
    }, []);

    const stopActivePrompt = useCallback(() => {
        void electronLlmRpc.stopActivePrompt();
    }, []);

    const startNewSession = useCallback(() => {
        void electronLlmRpc.stopActivePrompt();
        void electronLlmRpc.newSession();
    }, []);

    const [historyOpen, setHistoryOpen] = useState(false);
    const toggleHistory = useCallback(() => setHistoryOpen((open) => !open), []);
    const closeHistory = useCallback(() => setHistoryOpen(false), []);
    const switchSession = useCallback((id: string) => {
        void electronLlmRpc.stopActivePrompt();
        void electronLlmRpc.switchSession(id);
    }, []);
    const deleteSession = useCallback((id: string) => {
        void electronLlmRpc.deleteSession(id);
    }, []);

    const sendPrompt = useCallback((prompt: string) => {
        if (generatingResult)
            return;

        scrollToBottom();
        void electronLlmRpc.prompt(prompt);
    }, [generatingResult, scrollToBottom]);

    const onPromptInput = useCallback((currentText: string) => {
        void electronLlmRpc.setDraftPrompt(currentText);
    }, []);

    const setActiveProvider = useCallback((provider: LlmState["activeProvider"]) => {
        void electronLlmRpc.setActiveProvider(provider);
    }, []);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const openSettings = useCallback(() => setSettingsOpen(true), []);
    const closeSettings = useCallback(() => setSettingsOpen(false), []);
    const saveOpenAiApiKey = useCallback((key: string) => {
        void electronLlmRpc.setOpenAiApiKey(key);
    }, []);
    const clearOpenAiApiKey = useCallback(() => {
        void electronLlmRpc.clearOpenAiApiKey();
    }, []);
    const saveOpenAiModel = useCallback((model: string) => {
        void electronLlmRpc.setOpenAiModel(model);
    }, []);
    const resetOpenAiModel = useCallback(() => {
        void electronLlmRpc.setOpenAiModel("");
    }, []);
    const saveAnthropicApiKey = useCallback((key: string) => {
        void electronLlmRpc.setAnthropicApiKey(key);
    }, []);
    const clearAnthropicApiKey = useCallback(() => {
        void electronLlmRpc.clearAnthropicApiKey();
    }, []);
    const saveAnthropicModel = useCallback((model: string) => {
        void electronLlmRpc.setAnthropicModel(model);
    }, []);
    const resetAnthropicModel = useCallback(() => {
        void electronLlmRpc.setAnthropicModel("");
    }, []);
    const saveGeminiApiKey = useCallback((key: string) => {
        void electronLlmRpc.setGeminiApiKey(key);
    }, []);
    const clearGeminiApiKey = useCallback(() => {
        void electronLlmRpc.clearGeminiApiKey();
    }, []);
    const saveGeminiModel = useCallback((model: string) => {
        void electronLlmRpc.setGeminiModel(model);
    }, []);
    const resetGeminiModel = useCallback(() => {
        void electronLlmRpc.setGeminiModel("");
    }, []);
    const saveLocalTemperature = useCallback((temperature: number) => {
        void electronLlmRpc.setLocalTemperature(temperature);
    }, []);
    const saveLocalContextSize = useCallback((contextSize: number) => {
        void electronLlmRpc.setLocalContextSize(contextSize);
    }, []);
    const resetLocalContextSize = useCallback(() => {
        void electronLlmRpc.setLocalContextSize(undefined);
    }, []);

    const [mcpMessage, setMcpMessage] = useState<{type: "error" | "info", text: string}>();
    const addMcpServer = useCallback(async (config: {name: string, command: string, args: string[]}) => {
        setMcpMessage(undefined);
        try {
            await electronLlmRpc.addMcpServer(config);
        } catch (err) {
            setMcpMessage({type: "error", text: `MCPサーバーの追加に失敗しました: ${errorMessage(err)}`});
        }
    }, []);
    const removeMcpServer = useCallback((name: string) => {
        void electronLlmRpc.removeMcpServer(name);
    }, []);
    const toggleMcpServer = useCallback((name: string, enabled: boolean) => {
        void electronLlmRpc.setMcpServerEnabled(name, enabled);
    }, []);

    const onRagToggle = useCallback((enabled: boolean) => {
        void electronLlmRpc.setRagEnabled(enabled);
    }, []);

    const [ragMessage, setRagMessage] = useState<{type: "error" | "info", text: string}>();
    const onSelectEmbeddingModel = useCallback(async () => {
        setRagMessage(undefined);
        try {
            await electronLlmRpc.selectEmbeddingModelFile();
        } catch (err) {
            setRagMessage({type: "error", text: `埋め込みモデルの選択に失敗しました: ${errorMessage(err)}`});
        }
    }, []);
    const onLoadEmbeddingModel = useCallback(async () => {
        setRagMessage(undefined);
        try {
            await electronLlmRpc.loadSelectedEmbeddingModel();
        } catch (err) {
            setRagMessage({type: "error", text: `埋め込みモデルの読み込みに失敗しました: ${errorMessage(err)}`});
        }
    }, []);
    const onIngestDocument = useCallback(async () => {
        setRagMessage(undefined);
        try {
            const result = await electronLlmRpc.ingestDocumentFile();
            if (result != null && result.chunksAdded === 0)
                setRagMessage({type: "info", text: "登録できる内容が見つかりませんでした(ファイルが空の可能性があります)"});
        } catch (err) {
            setRagMessage({type: "error", text: `ドキュメントの取り込みに失敗しました: ${errorMessage(err)}`});
        }
    }, []);
    const onClearRag = useCallback(() => {
        void electronLlmRpc.clearRag();
    }, []);
    const onDeleteRagDocument = useCallback((source: string) => {
        void electronLlmRpc.deleteRagDocument(source);
    }, []);
    const onSelectModelDirectory = useCallback(() => {
        void electronLlmRpc.selectModelDirectory();
    }, []);

    const error = state.llama.error ?? state.model.error ?? state.context.error ?? state.contextSequence.error;
    const loading = state.selectedModelFilePath != null && error == null && (
        !state.model.loaded || !state.llama.loaded || !state.context.loaded || !state.contextSequence.loaded || !state.chatSession.loaded
    );
    const showMessage = state.selectedModelFilePath == null || error != null || state.chatSession.simplifiedChat.length === 0;

    return <div className={classNames("appRoot", historyOpen && "historyOpen")}>
        <SessionSidebar
            open={historyOpen}
            onClose={closeHistory}
            sessions={state.sessions.list}
            activeSessionId={state.sessions.activeSessionId}
            actionsEnabled={state.chatSession.loaded}
            onNewSession={startNewSession}
            onSwitchSession={switchSession}
            onDeleteSession={deleteSession}
        />
        <div className="app">
            <Header
                modelName={state.model.name}
                savedModelPath={state.savedModelPath}
                loadPercentage={state.model.loadProgress}
                onSelectModelClick={selectModelFile}
                onLoadModelClick={loadSelectedModel}
                onResetChatClick={
                    !showMessage
                        ? startNewSession
                        : undefined
                }
                activeProvider={state.activeProvider}
                openaiAvailable={state.providers.openai.available}
                anthropicAvailable={state.providers.anthropic.available}
                geminiAvailable={state.providers.gemini.available}
                onProviderChange={setActiveProvider}
                onSettingsClick={openSettings}
                onHistoryClick={toggleHistory}
                historyOpen={historyOpen}
                ragEnabled={state.ragEnabled}
                ragAvailable={state.rag.available}
                onRagToggle={onRagToggle}
            />
            <SettingsModal
                open={settingsOpen}
                onClose={closeSettings}
                openaiAvailable={state.providers.openai.available}
                onSaveOpenAiApiKey={saveOpenAiApiKey}
                onClearOpenAiApiKey={clearOpenAiApiKey}
                openAiModel={state.openAiModel}
                openAiDefaultModel={state.openAiDefaultModel}
                onSaveOpenAiModel={saveOpenAiModel}
                onResetOpenAiModel={resetOpenAiModel}
                anthropicAvailable={state.providers.anthropic.available}
                onSaveAnthropicApiKey={saveAnthropicApiKey}
                onClearAnthropicApiKey={clearAnthropicApiKey}
                anthropicModel={state.anthropicModel}
                anthropicDefaultModel={state.anthropicDefaultModel}
                onSaveAnthropicModel={saveAnthropicModel}
                onResetAnthropicModel={resetAnthropicModel}
                geminiAvailable={state.providers.gemini.available}
                onSaveGeminiApiKey={saveGeminiApiKey}
                onClearGeminiApiKey={clearGeminiApiKey}
                geminiModel={state.geminiModel}
                geminiDefaultModel={state.geminiDefaultModel}
                onSaveGeminiModel={saveGeminiModel}
                onResetGeminiModel={resetGeminiModel}
                localTemperature={state.localTemperature}
                onSaveLocalTemperature={saveLocalTemperature}
                localContextSize={state.localContextSize}
                onSaveLocalContextSize={saveLocalContextSize}
                onResetLocalContextSize={resetLocalContextSize}
                mcpServers={state.mcp.servers}
                onAddMcpServer={addMcpServer}
                onRemoveMcpServer={removeMcpServer}
                onToggleMcpServer={toggleMcpServer}
                mcpMessage={mcpMessage}
                ragDocumentCount={state.rag.documentCount}
                ragDocuments={state.rag.documents}
                ragEmbeddingModelLoaded={state.rag.embeddingModelLoaded}
                ragEmbeddingModelName={state.rag.embeddingModelName}
                savedEmbeddingModelPath={state.savedEmbeddingModelPath}
                onSelectEmbeddingModel={onSelectEmbeddingModel}
                onLoadEmbeddingModel={onLoadEmbeddingModel}
                onIngestDocument={onIngestDocument}
                onClearRag={onClearRag}
                onDeleteRagDocument={onDeleteRagDocument}
                ragMessage={ragMessage}
                modelDirectory={state.modelDirectory}
                onSelectModelDirectory={onSelectModelDirectory}
            />
            {
                showMessage &&
            <div className="message">
                {
                    error != null &&
                    <div className="error">
                        {String(error)}
                    </div>
                }
                {
                    loading &&
                    <div className="loading">
                        Loading...
                    </div>
                }
                {
                    (state.selectedModelFilePath == null || state.llama.error != null) &&
                    <div className="loadModel">
                        <div className="hint">
                            {
                                state.savedModelPath != null
                                    ? "上の再生ボタンをクリックしてモデルを読み込んでください"
                                    : "上のフォルダボタンをクリックしてモデルファイルを選択してください"
                            }
                        </div>
                        <div className="actions">
                            <a className="starLink" target="_blank" href="https://github.com/withcatai/node-llama-cpp">
                                <StarIconSVG className="starIcon" />
                                <div className="text">
                                    Star <code>node-llama-cpp</code> on GitHub
                                </div>
                            </a>

                            <div className="separator"></div>
                            <div className="title">DeepSeek R1 Distill Qwen model</div>
                            <div className="links">
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/mradermacher/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B.Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Get 7B</div>
                                </a>
                                <div className="separator" />
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/mradermacher/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B.Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Get 14B</div>
                                </a>
                                <div className="separator" />
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/mradermacher/DeepSeek-R1-Distill-Qwen-32B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-32B.Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Get 32B</div>
                                </a>
                            </div>

                            <div className="separator"></div>
                            <div className="title">Other models</div>
                            <div className="links">
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/giladgd/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b.MXFP4.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text"><code>gpt-oss</code> 20B</div>
                                </a>
                                <div className="separator" />
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/giladgd/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it.Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Gemma 4 8B E4B</div>
                                </a>
                                <div className="separator" />
                                <a
                                    target="_blank"
                                    href="https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf"
                                >
                                    <DownloadIconSVG className="downloadIcon" />
                                    <div className="text">Qwen 3.5 4B</div>
                                </a>
                            </div>

                            <div className="separator"></div>
                            <a className="browseLink" target="_blank" href="https://huggingface.co/models?pipeline_tag=text-generation&library=gguf&sort=trending">
                                <SearchIconSVG className="searchIcon" />
                                <div className="text">Find more models</div>
                            </a>
                        </div>
                    </div>
                }
                {
                    (
                        !loading &&
                        state.selectedModelFilePath != null &&
                        error == null &&
                        state.chatSession.simplifiedChat.length === 0
                    ) &&
                    <div className="typeMessage">
                        Type a message to start the conversation
                    </div>
                }
            </div>
            }
            {
                !showMessage &&
            <ChatHistory
                className="chatHistory"
                simplifiedChat={state.chatSession.simplifiedChat}
                generatingResult={generatingResult}
                activeProvider={state.activeProvider}
            />
            }
            {
                state.chatSession.lastError != null &&
            <div className="promptError">
                {state.chatSession.lastError}
            </div>
            }
            <InputRow
                disabled={!state.model.loaded || !state.contextSequence.loaded}
                stopGeneration={
                    generatingResult
                        ? stopActivePrompt
                        : undefined
                }
                onPromptInput={onPromptInput}
                sendPrompt={sendPrompt}
                generatingResult={generatingResult}
                autocompleteInputDraft={state.chatSession.draftPrompt.prompt}
                autocompleteCompletion={state.chatSession.draftPrompt.completion}
            />
        </div>
    </div>;
}
