import {CSSProperties} from "react";
import classNames from "classnames";
import {LoadFileIconSVG} from "../../../icons/LoadFileIconSVG.tsx";
import {PlayIconSVG} from "../../../icons/PlayIconSVG.tsx";
import {DeleteIconSVG} from "../../../icons/DeleteIconSVG.tsx";
import {SettingsIconSVG} from "../../../icons/SettingsIconSVG.tsx";
import {HistoryIconSVG} from "../../../icons/HistoryIconSVG.tsx";
import {FixedDivWithSpacer} from "../FixedDivWithSpacer/FixedDivWithSpacer.tsx";

import "./Header.css";
import type {CloudProviderId, ProviderId} from "../../../../electron/state/llmState.ts";


export function Header({
    modelName, savedModelPath, onSelectModelClick, onLoadModelClick,
    loadPercentage, onResetChatClick,
    activeProvider, lastCloudProvider, openaiAvailable, anthropicAvailable, geminiAvailable, onProviderChange,
    onSettingsClick, onHistoryClick, historyOpen, ragEnabled, ragAvailable, ragLoadable, onRagToggle
}: HeaderProps) {
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

    // we use a FixedDivWithSpacer to push down the content while keeping the header fixed.
    // this allows the content to have macOS's scroll bounce while keeping the header fixed at the top.
    return <FixedDivWithSpacer className="appHeader">
        <div className="panel model">
            <div
                className={classNames("progress", loadPercentage === 1 && "hide")}
                style={{
                    "--progress": loadPercentage != null ? (loadPercentage * 100) : undefined
                } as CSSProperties}
            />

            {
                modelName != null &&
                <div className="modelName" title={modelName}>{modelName}</div>
            }
            {
                modelName == null && savedModelName != null &&
                <div className="noModel" title={savedModelPath}>未読み込み: {savedModelName}</div>
            }
            {
                modelName == null && savedModelName == null &&
                <div className="noModel">No model loaded</div>
            }

            <button
                className="resetChatButton"
                disabled={onResetChatClick == null}
                onClick={onResetChatClick}
            >
                <DeleteIconSVG className="icon" />
            </button>
            <button
                className="loadModelButton"
                title="モデルを読み込む"
                onClick={onLoadModelClick}
                disabled={onLoadModelClick == null || savedModelPath == null}
            >
                <PlayIconSVG className="icon" />
            </button>
            <button className="selectModelButton" title="モデルファイルを選択" onClick={onSelectModelClick} disabled={onSelectModelClick == null}>
                <LoadFileIconSVG className="icon" />
            </button>
        </div>
        {
            activeProvider != null && onProviderChange != null &&
            <div className="panel providerSwitch">
                <button
                    className={classNames("providerButton", activeProvider === "local" && "active")}
                    onClick={() => onProviderChange("local")}
                >
                    Local
                </button>
                <button
                    className={classNames("providerButton", activeProvider === "auto" && "active")}
                    title="Let the local model decide whether to answer itself or forward to a cloud provider"
                    onClick={() => onProviderChange("auto")}
                >
                    Auto
                </button>
                <select
                    className={classNames("providerButton providerSelect", isCloudProvider(activeProvider) && "active")}
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
        }
        {
            onRagToggle != null &&
            <div className="panel providerSwitch">
                <button
                    className={classNames("providerButton", ragEnabled && "active")}
                    disabled={!ragAvailable && !ragLoadable}
                    title={
                        ragAvailable
                            ? "Augment answers with retrieved context from your documents"
                            : ragLoadable
                                ? "Click to load the embedding model and enable RAG"
                                : "Load an embedding model and connect to Qdrant in Settings to enable this"
                    }
                    onClick={() => onRagToggle(!ragEnabled)}
                >
                    RAG
                </button>
            </div>
        }
        <div className="spacer" />
        {
            onHistoryClick != null &&
            <div className="panel settingsButton">
                <button className={classNames(historyOpen && "active")} onClick={onHistoryClick} title="会話履歴">
                    <HistoryIconSVG className="icon" />
                </button>
            </div>
        }
        {
            onSettingsClick != null &&
            <div className="panel settingsButton">
                <button onClick={onSettingsClick}>
                    <SettingsIconSVG className="icon" />
                </button>
            </div>
        }
    </FixedDivWithSpacer>;
}

type HeaderProps = {
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
    onRagToggle?(enabled: boolean): void
};
