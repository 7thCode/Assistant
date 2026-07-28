import {useCallback, useState} from "react";

import "./SettingsModal.css";
import type {DocumentSummary} from "../../../../electron/rag/qdrantClient.ts";
import type {McpServerStatus} from "../../../../electron/state/llmState.ts";

const knownOpenAiModels = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

export function SettingsModal({
    open, onClose, openaiAvailable, onSaveApiKey, onClearApiKey,
    openAiModel, openAiDefaultModel, onSaveOpenAiModel, onResetOpenAiModel,
    localTemperature, onSaveLocalTemperature, localContextSize, onSaveLocalContextSize, onResetLocalContextSize,
    mcpServers, onAddMcpServer, onRemoveMcpServer, onToggleMcpServer, mcpMessage,
    ragDocumentCount, ragDocuments, ragEmbeddingModelLoaded, ragEmbeddingModelName, savedEmbeddingModelPath,
    onSelectEmbeddingModel, onLoadEmbeddingModel, onIngestDocument, onClearRag, onDeleteRagDocument, ragMessage,
    modelDirectory, onSelectModelDirectory
}: SettingsModalProps) {
    const savedEmbeddingModelName = savedEmbeddingModelPath?.split(/[/\\]/).pop();
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [modelInput, setModelInput] = useState("");
    const [mcpName, setMcpName] = useState("");
    const [mcpCommand, setMcpCommand] = useState("");
    const [mcpArgs, setMcpArgs] = useState("");
    const [temperatureInput, setTemperatureInput] = useState("");
    const [contextSizeInput, setContextSizeInput] = useState("");

    const save = useCallback(() => {
        if (apiKeyInput === "")
            return;

        onSaveApiKey(apiKeyInput);
        setApiKeyInput("");
    }, [apiKeyInput, onSaveApiKey]);

    const clear = useCallback(() => {
        onClearApiKey();
        setApiKeyInput("");
    }, [onClearApiKey]);

    const saveModel = useCallback(() => {
        if (modelInput === "")
            return;

        onSaveOpenAiModel(modelInput);
        setModelInput("");
    }, [modelInput, onSaveOpenAiModel]);

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
                    <div className="label">OpenAI API Key</div>
                    <div className="status">
                        {openaiAvailable ? "設定済み" : "未設定"}
                    </div>
                    <div className="row">
                        <input
                            type="password"
                            className="apiKeyInput"
                            placeholder="sk-..."
                            value={apiKeyInput}
                            onChange={(event) => setApiKeyInput(event.target.value)}
                        />
                        <button className="saveButton" disabled={apiKeyInput === ""} onClick={save}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={!openaiAvailable} onClick={clear}>
                        Clear stored key
                    </button>
                </div>

                <div className="section">
                    <div className="label">OpenAIモデル</div>
                    <div className="status">
                        現在: {openAiModel ?? `${openAiDefaultModel} (既定)`}
                    </div>
                    <div className="row">
                        <input
                            type="text"
                            className="apiKeyInput"
                            list="openaiModelOptions"
                            placeholder={openAiDefaultModel}
                            value={modelInput}
                            onChange={(event) => setModelInput(event.target.value)}
                        />
                        <datalist id="openaiModelOptions">
                            {knownOpenAiModels.map((model) => <option key={model} value={model} />)}
                        </datalist>
                        <button className="saveButton" disabled={modelInput === ""} onClick={saveModel}>
                            Save
                        </button>
                    </div>
                    <button className="clearButton" disabled={openAiModel == null} onClick={onResetOpenAiModel}>
                        既定に戻す
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

                <div className="section full">
                    <div className="label">RAG (Qdrant)</div>
                    <div className="status">
                        {
                            ragEmbeddingModelLoaded
                                ? `埋め込みモデル: ${ragEmbeddingModelName ?? "読み込み済み"}`
                                : savedEmbeddingModelName != null
                                    ? `未読み込み: ${savedEmbeddingModelName}`
                                    : "埋め込みモデル未読み込み"
                        }
                        {" / "}
                        登録済みチャンク数: {ragDocumentCount}
                    </div>
                    <div className="row">
                        <button className="saveButton" onClick={onSelectEmbeddingModel}>
                            ファイルを選択
                        </button>
                        <button className="saveButton" disabled={savedEmbeddingModelPath == null} onClick={onLoadEmbeddingModel}>
                            読み込む
                        </button>
                    </div>
                    <div className="row">
                        <button className="saveButton" disabled={!ragEmbeddingModelLoaded} onClick={onIngestDocument}>
                            ドキュメントを追加
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
                        ナレッジベースをクリア
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
    onSaveApiKey(key: string): void,
    onClearApiKey(): void,
    openAiModel?: string,
    openAiDefaultModel: string,
    onSaveOpenAiModel(model: string): void,
    onResetOpenAiModel(): void,
    localTemperature: number,
    onSaveLocalTemperature(temperature: number): void,
    localContextSize?: number,
    onSaveLocalContextSize(contextSize: number): void,
    onResetLocalContextSize(): void,
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
    onSelectModelDirectory(): void
};
