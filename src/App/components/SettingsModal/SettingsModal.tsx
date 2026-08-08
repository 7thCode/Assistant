import {useCallback, useState} from "react";

import "./SettingsModal.css";
import type {DocumentSummary} from "../../../../electron/rag/qdrantClient.ts";
import type {McpServerStatus, UsageStats} from "../../../../electron/state/llmState.ts";

const knownOpenAiModels = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const knownAnthropicModels = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];
const knownGeminiModels = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function SettingsModal({
    open, onClose,
    openaiAvailable, onSaveOpenAiApiKey, onClearOpenAiApiKey, openAiModel, openAiDefaultModel, onSaveOpenAiModel, onResetOpenAiModel,
    anthropicAvailable, onSaveAnthropicApiKey, onClearAnthropicApiKey,
    anthropicModel, anthropicDefaultModel, onSaveAnthropicModel, onResetAnthropicModel,
    geminiAvailable, onSaveGeminiApiKey, onClearGeminiApiKey, geminiModel, geminiDefaultModel, onSaveGeminiModel, onResetGeminiModel,
    localTemperature, onSaveLocalTemperature, localContextSize, onSaveLocalContextSize, onResetLocalContextSize,
    systemPrompt, onSaveSystemPrompt,
    mcpServers, onAddMcpServer, onRemoveMcpServer, onToggleMcpServer, mcpMessage,
    ragDocumentCount, ragDocuments, ragEmbeddingModelLoaded, ragEmbeddingModelName, savedEmbeddingModelPath,
    onSelectEmbeddingModel, onLoadEmbeddingModel, onIngestDocument, onClearRag, onDeleteRagDocument, ragMessage,
    modelDirectory, onSelectModelDirectory, usageStats
}: SettingsModalProps) {
    const savedEmbeddingModelName = savedEmbeddingModelPath?.split(/[/\\]/).pop();
    const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState("");
    const [openaiModelInput, setOpenaiModelInput] = useState("");
    const [anthropicApiKeyInput, setAnthropicApiKeyInput] = useState("");
    const [anthropicModelInput, setAnthropicModelInput] = useState("");
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState("");
    const [geminiModelInput, setGeminiModelInput] = useState("");
    const [mcpName, setMcpName] = useState("");
    const [mcpCommand, setMcpCommand] = useState("");
    const [mcpArgs, setMcpArgs] = useState("");
    const [temperatureInput, setTemperatureInput] = useState("");
    const [contextSizeInput, setContextSizeInput] = useState("");
    const [systemPromptInput, setSystemPromptInput] = useState("");

    const saveOpenaiKey = useCallback(() => {
        if (openaiApiKeyInput === "")
            return;

        onSaveOpenAiApiKey(openaiApiKeyInput);
        setOpenaiApiKeyInput("");
    }, [openaiApiKeyInput, onSaveOpenAiApiKey]);

    const clearOpenaiKey = useCallback(() => {
        onClearOpenAiApiKey();
        setOpenaiApiKeyInput("");
    }, [onClearOpenAiApiKey]);

    const saveOpenaiModel = useCallback(() => {
        if (openaiModelInput === "")
            return;

        onSaveOpenAiModel(openaiModelInput);
        setOpenaiModelInput("");
    }, [openaiModelInput, onSaveOpenAiModel]);

    const saveAnthropicKey = useCallback(() => {
        if (anthropicApiKeyInput === "")
            return;

        onSaveAnthropicApiKey(anthropicApiKeyInput);
        setAnthropicApiKeyInput("");
    }, [anthropicApiKeyInput, onSaveAnthropicApiKey]);

    const clearAnthropicKey = useCallback(() => {
        onClearAnthropicApiKey();
        setAnthropicApiKeyInput("");
    }, [onClearAnthropicApiKey]);

    const saveAnthropicModel = useCallback(() => {
        if (anthropicModelInput === "")
            return;

        onSaveAnthropicModel(anthropicModelInput);
        setAnthropicModelInput("");
    }, [anthropicModelInput, onSaveAnthropicModel]);

    const saveGeminiKey = useCallback(() => {
        if (geminiApiKeyInput === "")
            return;

        onSaveGeminiApiKey(geminiApiKeyInput);
        setGeminiApiKeyInput("");
    }, [geminiApiKeyInput, onSaveGeminiApiKey]);

    const clearGeminiKey = useCallback(() => {
        onClearGeminiApiKey();
        setGeminiApiKeyInput("");
    }, [onClearGeminiApiKey]);

    const saveGeminiModel = useCallback(() => {
        if (geminiModelInput === "")
            return;

        onSaveGeminiModel(geminiModelInput);
        setGeminiModelInput("");
    }, [geminiModelInput, onSaveGeminiModel]);

    const saveTemperature = useCallback(() => {
        if (temperatureInput === "")
            return;

        const value = Number(temperatureInput);
        if (Number.isNaN(value) || value < 0)
            return;

        onSaveLocalTemperature(value);
        setTemperatureInput("");
    }, [temperatureInput, onSaveLocalTemperature]);

    const saveContextSize = useCallback(() => {
        if (contextSizeInput === "")
            return;

        const value = Number(contextSizeInput);
        if (!Number.isInteger(value) || value <= 0)
            return;

        onSaveLocalContextSize(value);
        setContextSizeInput("");
    }, [contextSizeInput, onSaveLocalContextSize]);

    const saveSystemPrompt = useCallback(() => {
        if (systemPromptInput === "")
            return;

        onSaveSystemPrompt(systemPromptInput);
        setSystemPromptInput("");
    }, [systemPromptInput, onSaveSystemPrompt]);

    const clearSystemPrompt = useCallback(() => {
        onSaveSystemPrompt("");
        setSystemPromptInput("");
    }, [onSaveSystemPrompt]);

    const addServer = useCallback(() => {
        if (mcpName === "" || mcpCommand === "")
            return;

        onAddMcpServer({
            name: mcpName,
            command: mcpCommand,
            args: mcpArgs.trim() === "" ? [] : mcpArgs.trim().split(/\s+/)
        });
        setMcpName("");
        setMcpCommand("");
        setMcpArgs("");
    }, [mcpName, mcpCommand, mcpArgs, onAddMcpServer]);

    if (!open)
        return null;

    return <div className="settingsModalOverlay" onClick={onClose}>
        <div className="settingsModal" onClick={(event) => event.stopPropagation()}>
            <div className="header">
                <div className="title">Settings</div>
                <button className="closeButton" onClick={onClose}>✕</button>
            </div>

            <div className="sections">
                <div className="section">
                    <div className="label">モデルディレクトリ</div>
                    <div className="status" title={modelDirectory}>
                        {modelDirectory ?? "未設定(自動検出した場所を使用)"}
                    </div>
                    <button className="saveButton" onClick={onSelectModelDirectory}>
                        フォルダを選択
                    </button>
                </div>

                <div className="section">
                    <div className="label">利用統計</div>
                    <div className="status">ローカル完結: {usageStats.local}回</div>
                    <div className="status">ChatGPT: {usageStats.openai}回</div>
                    <div className="status">Claude: {usageStats.anthropic}回</div>
                    <div className="status">Gemini: {usageStats.gemini}回</div>
                </div>

                <div className="section">
                    <div className="label">システムプロンプト</div>
                    <div className="status">
                        {systemPrompt == null ? "未設定" : systemPrompt}(次の新しい会話から反映・ローカル/クラウド共通)
                    </div>
                    <textarea
                        className="systemPromptInput"
                        rows={4}
                        placeholder={systemPrompt ?? "例: あなたは親切な日本語アシスタントです。"}
                        value={systemPromptInput}
                        onChange={(event) => setSystemPromptInput(event.target.value)}
                    />
                    <div className="row">
                        <button className="saveButton" disabled={systemPromptInput === ""} onClick={saveSystemPrompt}>
                            Save
                        </button>
                        <button className="clearButton" disabled={systemPrompt == null} onClick={clearSystemPrompt}>
                            クリア
                        </button>
                    </div>
                </div>

                <div className="section">
                    <div className="label">ローカルモデル</div>
                    <div className="status">
                        温度: {localTemperature}(次のプロンプトから即時反映)
                    </div>
                    <div className="row">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            className="apiKeyInput"
                            placeholder={String(localTemperature)}
                            value={temperatureInput}
                            onChange={(event) => setTemperatureInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={temperatureInput === ""} onClick={saveTemperature}>
                            Save
                        </button>
                    </div>
                    <div className="status">
                        コンテキスト長: {localContextSize ?? "自動"}(次回モデル読み込み時に反映)
                    </div>
                    <div className="row">
                        <input
                            type="number"
                            step="1"
                            min="1"
                            className="apiKeyInput"
                            placeholder="自動"
                            value={contextSizeInput}
                            onChange={(event) => setContextSizeInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={contextSizeInput === ""} onClick={saveContextSize}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={localContextSize == null} onClick={onResetLocalContextSize}>
                        自動に戻す
                    </button>
                </div>

                <div className="section">
                    <div className="label">OpenAI (ChatGPT)</div>
                    <div className="status">
                        APIキー: {openaiAvailable ? "設定済み" : "未設定"} / モデル: {openAiModel ?? `${openAiDefaultModel} (既定)`}
                    </div>
                    <div className="row">
                        <input
                            type="password"
                            className="apiKeyInput"
                            placeholder="sk-..."
                            value={openaiApiKeyInput}
                            onChange={(event) => setOpenaiApiKeyInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={openaiApiKeyInput === ""} onClick={saveOpenaiKey}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={!openaiAvailable} onClick={clearOpenaiKey}>
                        APIキーを削除
                    </button>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            list="openaiModelOptions"
                            placeholder={openAiDefaultModel}
                            value={openaiModelInput}
                            onChange={(event) => setOpenaiModelInput(event.target.value)}
                        />
                        <datalist id="openaiModelOptions">
                            {knownOpenAiModels.map((model) => <option key={model} value={model} />)}
                        </datalist>
                        <button className="saveButton" disabled={openaiModelInput === ""} onClick={saveOpenaiModel}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={openAiModel == null} onClick={onResetOpenAiModel}>
                        モデルを既定に戻す
                    </button>
                </div>

                <div className="section">
                    <div className="label">Anthropic (Claude)</div>
                    <div className="status">
                        APIキー: {anthropicAvailable ? "設定済み" : "未設定"} / モデル: {anthropicModel ?? `${anthropicDefaultModel} (既定)`}
                    </div>
                    <div className="row">
                        <input
                            type="password"
                            className="apiKeyInput"
                            placeholder="sk-ant-..."
                            value={anthropicApiKeyInput}
                            onChange={(event) => setAnthropicApiKeyInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={anthropicApiKeyInput === ""} onClick={saveAnthropicKey}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={!anthropicAvailable} onClick={clearAnthropicKey}>
                        APIキーを削除
                    </button>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            list="anthropicModelOptions"
                            placeholder={anthropicDefaultModel}
                            value={anthropicModelInput}
                            onChange={(event) => setAnthropicModelInput(event.target.value)}
                        />
                        <datalist id="anthropicModelOptions">
                            {knownAnthropicModels.map((model) => <option key={model} value={model} />)}
                        </datalist>
                        <button className="saveButton" disabled={anthropicModelInput === ""} onClick={saveAnthropicModel}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={anthropicModel == null} onClick={onResetAnthropicModel}>
                        モデルを既定に戻す
                    </button>
                </div>

                <div className="section">
                    <div className="label">Google (Gemini)</div>
                    <div className="status">
                        APIキー: {geminiAvailable ? "設定済み" : "未設定"} / モデル: {geminiModel ?? `${geminiDefaultModel} (既定)`}
                    </div>
                    <div className="row">
                        <input
                            type="password"
                            className="apiKeyInput"
                            placeholder="AIza..."
                            value={geminiApiKeyInput}
                            onChange={(event) => setGeminiApiKeyInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={geminiApiKeyInput === ""} onClick={saveGeminiKey}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={!geminiAvailable} onClick={clearGeminiKey}>
                        APIキーを削除
                    </button>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            list="geminiModelOptions"
                            placeholder={geminiDefaultModel}
                            value={geminiModelInput}
                            onChange={(event) => setGeminiModelInput(event.target.value)}
                        />
                        <datalist id="geminiModelOptions">
                            {knownGeminiModels.map((model) => <option key={model} value={model} />)}
                        </datalist>
                        <button className="saveButton" disabled={geminiModelInput === ""} onClick={saveGeminiModel}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={geminiModel == null} onClick={onResetGeminiModel}>
                        モデルを既定に戻す
                    </button>
                </div>

                <div className="section">
                    <div className="label">MCPサーバー</div>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            placeholder="サーバー名"
                            value={mcpName}
                            onChange={(event) => setMcpName(event.target.value)}
                        />
                    </div>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            placeholder="実行コマンド (例: npx)"
                            value={mcpCommand}
                            onChange={(event) => setMcpCommand(event.target.value)}
                        />
                    </div>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            placeholder="引数 (スペース区切り、例: -y @some/mcp-server)"
                            value={mcpArgs}
                            onChange={(event) => setMcpArgs(event.target.value)}
                        />
                        <button className="saveButton" disabled={mcpName === "" || mcpCommand === ""} onClick={addServer}>
                            追加
                        </button>
                    </div>
                    {
                        mcpMessage != null &&
                        <div className={`ragMessage ${mcpMessage.type}`}>
                            {mcpMessage.text}
                        </div>
                    }
                    {
                        mcpServers.length > 0 &&
                        <ul className="documentList">
                            {
                                mcpServers.map((server) => (
                                    <li key={server.name}>
                                        <span
                                            className="documentName"
                                            title={server.error ?? `${server.command} ${server.args.join(" ")}`}
                                        >
                                            {server.name}
                                            {
                                                server.enabled
                                                    ? (server.connected ? ` (接続済み・ツール${server.toolCount}件)` : " (接続失敗)")
                                                    : " (無効)"
                                            }
                                        </span>
                                        <button
                                            className="documentDeleteButton"
                                            onClick={() => onToggleMcpServer(server.name, !server.enabled)}
                                        >
                                            {server.enabled ? "無効化" : "有効化"}
                                        </button>
                                        <button
                                            className="documentDeleteButton"
                                            onClick={() => onRemoveMcpServer(server.name)}
                                        >
                                            削除
                                        </button>
                                    </li>
                                ))
                            }
                        </ul>
                    }
                </div>

                <div className="section">
                    <div className="label">RAG用 埋め込みモデル</div>
                    <div className="status">
                        {
                            ragEmbeddingModelLoaded
                                ? `読み込み済み: ${ragEmbeddingModelName ?? "(名称不明)"}`
                                : savedEmbeddingModelName != null
                                    ? `未読み込み: ${savedEmbeddingModelName}`
                                    : "モデル未選択"
                        }
                    </div>
                    <div className="row">
                        <button className="saveButton" onClick={onSelectEmbeddingModel}>
                            モデルファイルを選択
                        </button>
                        <button
                            className="saveButton"
                            disabled={savedEmbeddingModelPath == null}
                            title={savedEmbeddingModelPath == null ? "先にモデルファイルを選択してください" : undefined}
                            onClick={onLoadEmbeddingModel}
                        >
                            モデルを読み込む
                        </button>
                    </div>
                </div>

                <div className="section full">
                    <div className="label">ナレッジベース (RAG)</div>
                    <div className="status">
                        登録済みチャンク数: {ragDocumentCount}
                    </div>
                    <div className="row">
                        <button
                            className="saveButton"
                            disabled={!ragEmbeddingModelLoaded}
                            title={ragEmbeddingModelLoaded ? undefined : "先に埋め込みモデルを読み込んでください"}
                            onClick={onIngestDocument}
                        >
                            ドキュメントを取り込む
                        </button>
                    </div>
                    {
                        ragMessage != null &&
                        <div className={`ragMessage ${ragMessage.type}`}>
                            {ragMessage.text}
                        </div>
                    }
                    {
                        ragDocuments.length > 0 &&
                        <ul className="documentList">
                            {
                                ragDocuments.map((doc) => (
                                    <li key={doc.source}>
                                        <span className="documentName" title={doc.source}>{doc.source}</span>
                                        <span className="documentChunkCount">{doc.chunkCount}件</span>
                                        <button
                                            className="documentDeleteButton"
                                            onClick={() => onDeleteRagDocument(doc.source)}
                                        >
                                            削除
                                        </button>
                                    </li>
                                ))
                            }
                        </ul>
                    }
                    <button className="clearButton" disabled={ragDocumentCount === 0} onClick={onClearRag}>
                        すべて削除
                    </button>
                </div>
            </div>

            <div className="hint">
                ローカルモデルのファイル選択・読み込みはヘッダーのボタンから行えます。
            </div>
        </div>
    </div>;
}

type SettingsModalProps = {
    open: boolean,
    onClose(): void,
    openaiAvailable: boolean,
    onSaveOpenAiApiKey(key: string): void,
    onClearOpenAiApiKey(): void,
    openAiModel?: string,
    openAiDefaultModel: string,
    onSaveOpenAiModel(model: string): void,
    onResetOpenAiModel(): void,
    anthropicAvailable: boolean,
    onSaveAnthropicApiKey(key: string): void,
    onClearAnthropicApiKey(): void,
    anthropicModel?: string,
    anthropicDefaultModel: string,
    onSaveAnthropicModel(model: string): void,
    onResetAnthropicModel(): void,
    geminiAvailable: boolean,
    onSaveGeminiApiKey(key: string): void,
    onClearGeminiApiKey(): void,
    geminiModel?: string,
    geminiDefaultModel: string,
    onSaveGeminiModel(model: string): void,
    onResetGeminiModel(): void,
    localTemperature: number,
    onSaveLocalTemperature(temperature: number): void,
    localContextSize?: number,
    onSaveLocalContextSize(contextSize: number): void,
    onResetLocalContextSize(): void,
    systemPrompt?: string,
    /** Pass `""` to clear it. */
    onSaveSystemPrompt(prompt: string): void,
    mcpServers: McpServerStatus[],
    onAddMcpServer(config: {name: string, command: string, args: string[]}): void,
    onRemoveMcpServer(name: string): void,
    onToggleMcpServer(name: string, enabled: boolean): void,
    mcpMessage?: {type: "error" | "info", text: string},
    ragDocumentCount: number,
    ragDocuments: DocumentSummary[],
    ragEmbeddingModelLoaded: boolean,
    ragEmbeddingModelName?: string,
    savedEmbeddingModelPath?: string,
    onSelectEmbeddingModel(): void,
    onLoadEmbeddingModel(): void,
    onIngestDocument(): void,
    onClearRag(): void,
    onDeleteRagDocument(source: string): void,
    ragMessage?: {type: "error" | "info", text: string},
    modelDirectory?: string,
    onSelectModelDirectory(): void,
    usageStats: UsageStats
};
