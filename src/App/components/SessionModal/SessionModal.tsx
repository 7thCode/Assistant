import classNames from "classnames";

import "./SessionModal.css";
import type {SessionSummary} from "../../../../electron/state/llmState.ts";

function formatUpdatedAt(iso: string): string {
    return new Date(iso).toLocaleString();
}

export function SessionModal({
    open, onClose, sessions, activeSessionId, actionsEnabled, onNewSession, onSwitchSession, onDeleteSession
}: SessionModalProps) {
    if (!open)
        return null;

    const actionsTitle = actionsEnabled ? undefined : "モデルの読み込み完了後に利用できます";

    return <div className="sessionModalOverlay" onClick={onClose}>
        <div className="sessionModal" onClick={(event) => event.stopPropagation()}>
            <div className="header">
                <div className="title">会話履歴</div>
                <button className="closeButton" onClick={onClose}>✕</button>
            </div>

            <button className="newSessionButton" disabled={!actionsEnabled} title={actionsTitle} onClick={onNewSession}>
                + 新しい会話
            </button>

            {
                sessions.length === 0 &&
                <div className="empty">保存された会話はありません</div>
            }

            {
                sessions.length > 0 &&
                <ul className="sessionList">
                    {
                        sessions.map((session) => (
                            <li
                                key={session.id}
                                className={classNames("sessionItem", session.id === activeSessionId && "active")}
                            >
                                <button
                                    className="sessionSwitchButton"
                                    disabled={!actionsEnabled}
                                    title={actionsTitle}
                                    onClick={() => onSwitchSession(session.id)}
                                >
                                    <span className="sessionTitle">{session.title}</span>
                                    <span className="sessionUpdatedAt">{formatUpdatedAt(session.updatedAt)}</span>
                                </button>
                                <button
                                    className="sessionDeleteButton"
                                    disabled={!actionsEnabled}
                                    title={actionsTitle ?? "この会話を削除"}
                                    onClick={() => onDeleteSession(session.id)}
                                >
                                    削除
                                </button>
                            </li>
                        ))
                    }
                </ul>
            }
        </div>
    </div>;
}

type SessionModalProps = {
    open: boolean,
    onClose(): void,
    sessions: SessionSummary[],
    activeSessionId?: string,
    /** Session actions require a loaded chat session; disabled (with an explanatory title) until then. */
    actionsEnabled: boolean,
    onNewSession(): void,
    onSwitchSession(id: string): void,
    onDeleteSession(id: string): void
};
