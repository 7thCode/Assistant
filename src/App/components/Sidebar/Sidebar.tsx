import {CSSProperties} from "react";
import classNames from "classnames";
import {LoadFileIconSVG} from "../../../icons/LoadFileIconSVG.tsx";
import {PlayIconSVG} from "../../../icons/PlayIconSVG.tsx";
import {DeleteIconSVG} from "../../../icons/DeleteIconSVG.tsx";
import {SettingsIconSVG} from "../../../icons/SettingsIconSVG.tsx";
import {HistoryIconSVG} from "../../../icons/HistoryIconSVG.tsx";

import "./Sidebar.css";
import type {CloudProviderId, McpServerStatus, ProviderId} from "../../../../electron/state/llmState.ts";

export function Sidebar({
    modelName, savedModelPath, onSelectModelClick, onLoadModelClick,
    loadPercentage, onResetChatClick,
    activeProvider, lastCloudProvider, openaiAvailable, anthropicAvailable, geminiAvailable, onProviderChange,
    onSettingsClick, onHistoryClick, historyOpen, ragEnabled, ragAvailable, ragLoadable, onRagToggle, ragDocumentCount,
    contextUsage, mcpServers
}: SidebarProps) {
    const savedModelName = savedModelPath?.split(/[/\\]/).pop();

    const isCloudProvider = (provider?: ProviderId): provider is CloudProviderId =>
        provider === "openai" || provider === "anthropic" || provider === "gemini";
    const cloudProviderAvailable = (provider: CloudProviderId): boolean =>
        (provider === "openai" && !!openaiAvailable)
        || (provider === "anthropic" && !!anthropicAvailable)
        || (provider === "gemini" && !!geminiAvailable);

    // what the dropdown displays: the active cloud provider if one is active, otherwise the last one
    // explicitly picked (if it's still available), otherwise the first available in a fixed order.
    const selectedCloudProvider: CloudProviderId =
        (isCloudProvider(activeProvider) && activeProvider)
        || (lastCloudProvider != null && cloudProviderAvailable(lastCloudProvider) && lastCloudProvider)
        || (openaiAvailable ? "openai" : anthropicAvailable ? "anthropic" : "gemini");

    const connectedMcpServers = mcpServers?.filter((server) => server.enabled) ?? [];
    const contextWarn = contextUsage != null && (contextUsage.used / contextUsage.total) >= 0.9;

    return <div className="appSidebar">
        <div className="brand">
            <svg className="brandIcon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12h8M8 8h5M8 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="brandText sidebarHideNarrow">assistant</div>
        </div>

        <div className="section">
            <div className="sectionLabel sidebarHideNarrow">モデル</div>
            <div className="modelRow">
                <div className={classNames("statusDot", modelName != null && "active")} />
                <div className="modelName sidebarHideNarrow" title={modelName ?? savedModelPath}>
                    {
                        modelName ??
                        (savedModelName != null ? `未読み込み: ${savedModelName}` : "モデル未選択")
                    }
                </div>
            </div>
            {
                loadPercentage != null && loadPercentage < 1 &&
                <div className="progressTrack">
                    <div className="progressFill" style={{"--progress": loadPercentage * 100} as CSSProperties} />
                </div>
            }
            {
                contextUsage != null &&
                <div className={classNames("contextReadout sidebarHideNarrow", contextWarn && "warn")}>
                    {contextUsage.used.toLocaleString()} / {contextUsage.total.toLocaleString()}
                </div>
            }
            <div className="modelActions">
                <button
                    className="iconButton"
                    title="モデルファイルを選択"
                    onClick={onSelectModelClick}
                    disabled={onSelectModelClick == null}
                >
                    <LoadFileIconSVG className="icon" />
                </button>
                <button
                    className="iconButton"
                    title="モデルを読み込む"
                    onClick={onLoadModelClick}
                    disabled={onLoadModelClick == null || savedModelPath == null}
                >
                    <PlayIconSVG className="icon" />
                </button>
                <button
                    className="iconButton"
                    title="新しい会話"
                    disabled={onResetChatClick == null}
                    onClick={onResetChatClick}
                >
                    <DeleteIconSVG className="icon" />
                </button>
            </div>
        </div>

        {
            activeProvider != null && onProviderChange != null &&
            <div className="section">
                <div className="sectionLabel sidebarHideNarrow">プロバイダー</div>
                <div className="providerList">
                    <button
                        className={classNames("providerItem", activeProvider === "local" && "active")}
                        onClick={() => onProviderChange("local")}
                    >
                        <span className="providerDot" />
                        <span className="sidebarHideNarrow">Local</span>
                    </button>
                    <button
                        className={classNames("providerItem", activeProvider === "auto" && "active")}
                        title="Let the local model decide whether to answer itself or forward to a cloud provider"
                        onClick={() => onProviderChange("auto")}
                    >
                        <span className="providerDot" />
                        <span className="sidebarHideNarrow">Auto</span>
                    </button>
                    <select
                        className={classNames("providerItem providerSelect", isCloudProvider(activeProvider) && "active")}
                        disabled={!openaiAvailable && !anthropicAvailable && !geminiAvailable}
                        value={selectedCloudProvider}
                        onChange={(event) => onProviderChange(event.target.value as ProviderId)}
                    >
                        <option value="openai" disabled={!openaiAvailable}>
                            ChatGPT{openaiAvailable ? "" : "(APIキー未設定)"}
                        </option>
                        <option value="anthropic" disabled={!anthropicAvailable}>
                            Claude{anthropicAvailable ? "" : "(APIキー未設定)"}
                        </option>
                        <option value="gemini" disabled={!geminiAvailable}>
                            Gemini{geminiAvailable ? "" : "(APIキー未設定)"}
                        </option>
                    </select>
                </div>
            </div>
        }

        {
            onRagToggle != null &&
            <div className="section">
                <div className="sectionLabel sidebarHideNarrow">RAG</div>
                <div className="toggleRow">
                    <span className="toggleLabel sidebarHideNarrow">
                        {ragDocumentCount != null ? `登録済み ${ragDocumentCount}件` : "ナレッジベース"}
                    </span>
                    <button
                        className={classNames("switch", ragEnabled && "on")}
                        disabled={!ragAvailable && !ragLoadable}
                        title={
                            ragAvailable
                                ? "Augment answers with retrieved context from your documents"
                                : ragLoadable
                                    ? "Click to load the embedding model and enable RAG"
                                    : "Load an embedding model in Settings to enable this"
                        }
                        onClick={() => onRagToggle(!ragEnabled)}
                    >
                        <span className="knob" />
                    </button>
                </div>
            </div>
        }

        {
            connectedMcpServers.length > 0 &&
            <div className="section sidebarHideNarrow">
                <div className="sectionLabel">MCP サーバー</div>
                <div className="mcpList">
                    {
                        connectedMcpServers.map((server) => (
                            <div className="mcpRow" key={server.name} title={server.error}>
                                <div className={classNames("statusDot", server.connected && "active")} />
                                <span className="mcpName">{server.name}</span>
                                {
                                    server.connected &&
                                    <span className="mcpToolCount">{server.toolCount}</span>
                                }
                            </div>
                        ))
                    }
                </div>
            </div>
        }

        <div className="spacer" />

        {
            onHistoryClick != null &&
            <button className={classNames("bottomButton", historyOpen && "active")} onClick={onHistoryClick}>
                <HistoryIconSVG className="icon" />
                <span className="sidebarHideNarrow">会話履歴</span>
            </button>
        }
        {
            onSettingsClick != null &&
            <button className="bottomButton" onClick={onSettingsClick}>
                <SettingsIconSVG className="icon" />
                <span className="sidebarHideNarrow">Settings</span>
            </button>
        }
    </div>;
}

type SidebarProps = {
    modelName?: string,
    savedModelPath?: string,
    onSelectModelClick?(): void,
    onLoadModelClick?(): void,
    loadPercentage?: number,
    onResetChatClick?(): void,
    activeProvider?: ProviderId,
    lastCloudProvider?: CloudProviderId,
    openaiAvailable?: boolean,
    anthropicAvailable?: boolean,
    geminiAvailable?: boolean,
    onProviderChange?(provider: ProviderId): void,
    onSettingsClick?(): void,
    onHistoryClick?(): void,
    historyOpen?: boolean,
    ragEnabled?: boolean,
    ragAvailable?: boolean,
    /** Whether an embedding model file has been chosen and can be loaded on demand when RAG is turned on. */
    ragLoadable?: boolean,
    onRagToggle?(enabled: boolean): void,
    ragDocumentCount?: number,
    contextUsage?: {used: number, total: number},
    mcpServers?: McpServerStatus[]
};
