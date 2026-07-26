import {MessageMarkdown} from "../../../MessageMarkdown/MessageMarkdown.js";

import "./UserMessage.css";
import type {SimplifiedUserChatItem} from "../../../../../../electron/state/llmState.js";

export function UserMessage({message}: UserMessageProps) {
    return <div className="message user">
        <MessageMarkdown>
            {message.message}
        </MessageMarkdown>
        {
            message.ragContext != null &&
            <div className="ragBadge" title={message.ragContext}>参考情報を使用</div>
        }
    </div>;
}

type UserMessageProps = {
    message: SimplifiedUserChatItem
};
