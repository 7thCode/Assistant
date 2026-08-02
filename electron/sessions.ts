import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {app} from "electron";
import type {ChatHistoryItem} from "node-llama-cpp";
import type {ExecutedProviderId} from "./state/llmState.js";

export type SessionData = {
    id: string,
    title: string,
    createdAt: string,
    updatedAt: string,
    chatHistory: ChatHistoryItem[],
    modelTurnProviders: ExecutedProviderId[],
    modelTurnRoutingReasons: Array<string | undefined>,
    userTurnDisplayMessages: string[],
    userTurnRagContexts: Array<string | undefined>
};

export type SessionSummary = {
    id: string,
    title: string,
    createdAt: string,
    updatedAt: string
};

function getSessionsDir(): string {
    const dir = path.join(app.getPath("userData"), "sessions");
    fs.mkdirSync(dir, {recursive: true});
    return dir;
}

function getSessionFilePath(id: string): string {
    return path.join(getSessionsDir(), `${id}.json`);
}

export function generateSessionId(): string {
    return crypto.randomUUID();
}

export function createEmptySession(id: string): SessionData {
    const now = new Date().toISOString();
    return {
        id,
        title: "New chat",
        createdAt: now,
        updatedAt: now,
        chatHistory: [],
        modelTurnProviders: [],
        modelTurnRoutingReasons: [],
        userTurnDisplayMessages: [],
        userTurnRagContexts: []
    };
}

export function writeSession(data: SessionData): void {
    fs.writeFileSync(getSessionFilePath(data.id), JSON.stringify(data), "utf8");
}

export function readSession(id: string): SessionData | undefined {
    try {
        return JSON.parse(fs.readFileSync(getSessionFilePath(id), "utf8")) as SessionData;
    } catch {
        return undefined;
    }
}

export function deleteSessionFile(id: string): void {
    try {
        fs.unlinkSync(getSessionFilePath(id));
    } catch {
        // already gone
    }
}

/** Reads every session's metadata from disk, most recently updated first. */
export function listSessionSummaries(): SessionSummary[] {
    const dir = getSessionsDir();
    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));

    const summaries = files
        .map((file): SessionSummary | undefined => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as SessionData;
                return {id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt};
            } catch {
                return undefined;
            }
        })
        .filter((summary) => summary != null);

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deriveSessionTitle(message: string): string {
    const trimmed = message.trim().replace(/\s+/g, " ");
    if (trimmed === "")
        return "New chat";

    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}
