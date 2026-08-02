import {CSSProperties} from "react";
import classNames from "classnames";
import {LoadFileIconSVG} from "../../../icons/LoadFileIconSVG.tsx";
import {PlayIconSVG} from "../../../icons/PlayIconSVG.tsx";
import {DeleteIconSVG} from "../../../icons/DeleteIconSVG.tsx";
import {SettingsIconSVG} from "../../../icons/SettingsIconSVG.tsx";
import {HistoryIconSVG} from "../../../icons/HistoryIconSVG.tsx";
import {FixedDivWithSpacer} from "../FixedDivWithSpacer/FixedDivWithSpacer.tsx";

import "./Header.css";
import type {ProviderId} from "../../../../electron/state/llmState.ts";


export function Header({
    modelName, savedModelPath, onSelectModelClick, onLoadModelClick,
    loadPercentage, onResetChatClick,
    activeProvider, openaiAvailable, anthropicAvailable, geminiAvailable, onProviderChange,
    onSettingsClick, onHistoryClick, historyOpen, ragEnabled, ragAvailable, onRagToggle
}: HeaderProps) {
    const savedModelName = savedModelPath?.split(/[/\\]/).pop();

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
                <button
                    className={classNames("providerButton", activeProvider === "openai" && "active")}
                    disabled={!openaiAvailable}
                    title={openaiAvailable ? undefined : "Set an OpenAI API key in Settings to enable this"}
                    onClick={() => onProviderChange("openai")}
                >
                    ChatGPT
                </button>
                <button
                    className={classNames("providerButton", activeProvider === "anthropic" && "active")}
                    disabled={!anthropicAvailable}
                    title={anthropicAvailable ? undefined : "Set a Claude API key in Settings to enable this"}
                    onClick={() => onProviderChange("anthropic")}
                >
                    Claude
                </button>
                <button
                    className={classNames("providerButton", activeProvider === "gemini" && "active")}
                    disabled={!geminiAvailable}
                    title={geminiAvailable ? undefined : "Set a Gemini API key in Settings to enable this"}
                    onClick={() => onProviderChange("gemini")}
                >
                    Gemini
                </button>
            </div>
        }
        {
            onRagToggle != null &&
            <div className="panel providerSwitch">
                <button
                    className={classNames("providerButton", ragEnabled && "active")}
                    disabled={!ragAvailable}
                    title={
                        ragAvailable
                            ? "Augment answers with retrieved context from your documents"
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
    openaiAvailable?: boolean,
    anthropicAvailable?: boolean,
    geminiAvailable?: boolean,
    onProviderChange?(provider: ProviderId): void,
    onSettingsClick?(): void,
    onHistoryClick?(): void,
    historyOpen?: boolean,
    ragEnabled?: boolean,
    ragAvailable?: boolean,
    onRagToggle?(enabled: boolean): void
};
