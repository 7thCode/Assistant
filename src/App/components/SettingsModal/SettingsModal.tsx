import {useCallback, useState} from "react";

import "./SettingsModal.css";
import type {DocumentSummary} from "../../../../electron/rag/qdrantClient.ts";

export function SettingsModal({
    open, onClose, openaiAvailable, onSaveApiKey, onClearApiKey,
    ragDocumentCount, ragDocuments, ragEmbeddingModelLoaded, ragEmbeddingModelName, savedEmbeddingModelPath,
    onSelectEmbeddingModel, onLoadEmbeddingModel, onIngestDocument, onClearRag, onDeleteRagDocument, ragMessage,
    modelDirectory, onSelectModelDirectory
}: SettingsModalProps) {
    const savedEmbeddingModelName = savedEmbeddingModelPath?.split(/[/\\]/).pop();
    const [apiKeyInput, setApiKeyInput] = useState("");

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

    if (!open)
        return null;

    return <div className="settingsModalOverlay" onClick={onClose}>
        <div className="settingsModal" onClick={(event) => event.stopPropagation()}>
            <div className="header">
                <div className="title">Settings</div>
                <button className="closeButton" onClick={onClose}>✕</button>
            </div>

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
