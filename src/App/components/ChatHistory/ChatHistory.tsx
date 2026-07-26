import {useMemo} from "react";
import classNames from "classnames";
import {UserMessage} from "./components/UserMessage/UserMessage.js";
import {ModelMessage} from "./components/ModelMessage/ModelMessage.js";

import "./ChatHistory.css";
import type {ExecutedProviderId, LlmState, ProviderId, SimplifiedModelChatItem} from "../../../../electron/state/llmState.ts";


export function ChatHistory({simplifiedChat, generatingResult, activeProvider, className}: ChatHistoryProps) {
    const renderChatItems = useMemo(() => {
        if (simplifiedChat.length > 0 &&
            simplifiedChat.at(-1)!.type !== "model" &&
            generatingResult
        )
            return [...simplifiedChat, makeEmptyModelMessage(activeProvider === "openai" ? "openai" : "local")];

        return simplifiedChat;
    }, [simplifiedChat, generatingResult, activeProvider]);

    return <div className={classNames("appChatHistory", className)}>
        {
            renderChatItems
                .map((item, index) => {
                    if (item.type === "model")
                        return <ModelMessage
                            key={index}
                            modelMessage={item}
                            active={index === renderChatItems.length - 1 && generatingResult}
                        />;
                    else if (item.type === "user")
                        return <UserMessage key={index} message={item} />;

                    return null;
                })
        }
    </div>;
}

type ChatHistoryProps = {
    simplifiedChat: LlmState["chatSession"]["simplifiedChat"],
    generatingResult: boolean,
    activeProvider: ProviderId,
    className?: string
};

function makeEmptyModelMessage(producedBy: ExecutedProviderId): SimplifiedModelChatItem {
    return {
        type: "model",
        producedBy,
        message: []
    };
}
