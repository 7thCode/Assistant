import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";

import "./UserMessage.css";
import type {SimplifiedUserChatItem} from "../../../../../../electron/state/llmState.js";

export function UserMessage({message}: UserMessageProps) {
    return <MessageMarkdown className="message user">
        {message.message}
    </MessageMarkdown>;
}

type UserMessageProps = {
    message: SimplifiedUserChatItem
};
