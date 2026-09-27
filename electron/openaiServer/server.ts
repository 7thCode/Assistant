/* eslint-disable camelcase -- the request/response field names in this file are dictated by the OpenAI API */
import crypto from "node:crypto";
import http from "node:http";
import {z} from "zod";
import {getStoredApiKey, setStoredApiKey} from "../secretStore.js";
import {llmFunctions, llmState, ProviderUnavailableError, type ProviderId} from "../state/llmState.js";
import type {ChatMessage} from "../providers/types.js";

export type OpenAiServerStatus = {
    running: boolean,
    port?: number,
    token?: string
};

/** A fixed port (rather than an OS-assigned one) so OpenAI clients can keep the same base URL across app restarts. */
export const OPENAI_SERVER_PORT = 11500;

/** Bodies larger than this are rejected, so a runaway client can't exhaust memory. */
const maxRequestBodyBytes = 10 * 1024 * 1024;

/** The `model` values a client can send; each selects how the request is routed. */
const modelIds = ["auto", "local", "openai", "anthropic", "gemini"] as const satisfies readonly ProviderId[];
type ModelId = (typeof modelIds)[number];

const modelDescriptions: Record<ModelId, string> = {
    auto: "ローカルモデルで答えられるか判定し、無理ならクラウドに転送する",
    local: "ローカルモデル",
    openai: "ChatGPT (OpenAI)",
    anthropic: "Claude (Anthropic)",
    gemini: "Gemini (Google)"
};

let httpServer: http.Server | null = null;
let authToken: string | null = null;
const startedAtSeconds = Math.floor(Date.now() / 1000);

class HttpError extends Error {
    public readonly status: number;
    public readonly type: "invalid_request_error" | "server_error" | "authentication_error";
    public readonly code: string | null;

    public constructor(
        status: number, message: string, type: "invalid_request_error" | "server_error" | "authentication_error",
        code: string | null = null
    ) {
        super(message);
        this.status = status;
        this.type = type;
        this.code = code;
    }
}

const textPartSchema = z.object({type: z.literal("text"), text: z.string()});
const messageSchema = z.object({
    role: z.enum(["system", "developer", "user", "assistant"]),
    content: z.union([z.string(), z.array(textPartSchema), z.null()])
});
const requestSchema = z.object({
    model: z.string(),
    messages: z.array(messageSchema).min(1),
    stream: z.boolean().nullish(),
    temperature: z.number().min(0)
        .max(2)
        .nullish(),
    max_tokens: z.number().int()
        .positive()
        .nullish(),
    max_completion_tokens: z.number().int()
        .positive()
        .nullish(),
    tools: z.array(z.unknown()).nullish()
});

function isModelId(value: string): value is ModelId {
    return (modelIds as readonly string[]).includes(value);
}

/** Splits the OpenAI-style messages into a system prompt and strictly alternating user/assistant turns ending on a user turn. */
function normalizeMessages(messages: z.infer<typeof messageSchema>[]): {systemPrompt?: string, turns: ChatMessage[]} {
    const systemParts: string[] = [];
    const turns: ChatMessage[] = [];

    for (const message of messages) {
        const text = typeof message.content === "string"
            ? message.content
            : (message.content ?? []).map((part) => part.text).join("");

        if (message.role === "system" || message.role === "developer") {
            if (text !== "")
                systemParts.push(text);
            continue;
        }

        const previous = turns.at(-1);
        // cloud providers reject consecutive same-role messages, so adjacent ones are merged
        if (previous?.role === message.role)
            previous.content += `\n\n${text}`;
        else
            turns.push({role: message.role, content: text});
    }

    if (turns.at(-1)?.role !== "user")
        throw new HttpError(400, "messages の最後は user ロールである必要があります", "invalid_request_error");

    return {systemPrompt: systemParts.length > 0 ? systemParts.join("\n\n") : undefined, turns};
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > maxRequestBodyBytes)
            throw new HttpError(413, "リクエストボディが大きすぎます", "invalid_request_error");

        chunks.push(chunk);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    } catch {
        throw new HttpError(400, "リクエストボディが有効なJSONではありません", "invalid_request_error");
    }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {"content-type": "application/json"}).end(JSON.stringify(body));
}

function errorBody(err: HttpError) {
    return {error: {message: err.message, type: err.type, param: null, code: err.code}};
}

function isAuthorized(req: http.IncomingMessage): boolean {
    if (authToken == null)
        return false;

    const provided = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${authToken}`);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function listAvailableModels() {
    const {model, providers} = llmState.state;
    const cloudAvailable = providers.openai.available || providers.anthropic.available || providers.gemini.available;
    const availability: Record<ModelId, boolean> = {
        auto: model.loaded || cloudAvailable,
        local: model.loaded,
        openai: providers.openai.available,
        anthropic: providers.anthropic.available,
        gemini: providers.gemini.available
    };

    return modelIds
        .filter((id) => availability[id])
        .map((id) => ({id, object: "model", created: startedAtSeconds, owned_by: "assistant", description: modelDescriptions[id]}));
}

async function handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsed = requestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const where = issue == null || issue.path.length === 0 ? "" : ` (${issue.path.join(".")})`;
        throw new HttpError(400, `不正なリクエストです${where}: ${issue?.message ?? "invalid"}`, "invalid_request_error");
    }

    const body = parsed.data;
    if (!isModelId(body.model)) {
        throw new HttpError(
            404,
            `モデル "${body.model}" は存在しません。使用できるモデル: ${modelIds.join(", ")}`,
            "invalid_request_error",
            "model_not_found"
        );
    }
    if (body.tools != null && body.tools.length > 0)
        throw new HttpError(400, "tools には対応していません", "invalid_request_error", "unsupported_parameter");

    const {systemPrompt, turns} = normalizeMessages(body.messages);
    const stream = body.stream === true;
    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    const abortController = new AbortController();
    res.on("close", () => {
        if (!res.writableEnded)
            abortController.abort();
    });

    const chunkBody = (delta: Record<string, unknown>, finishReason: string | null) => ({
        id,
        object: "chat.completion.chunk",
        created,
        model: body.model,
        choices: [{index: 0, delta, finish_reason: finishReason}]
    });
    const writeEvent = (data: unknown) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // The SSE headers are sent lazily on the first event, so a failure before any output
    // (e.g. no model loaded) can still be reported with a proper HTTP status.
    let streamStarted = false;
    const ensureStreamStarted = () => {
        if (streamStarted)
            return;

        streamStarted = true;
        res.writeHead(200, {"content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive"});
        writeEvent(chunkBody({role: "assistant", content: ""}, null));
    };

    try {
        const result = await llmFunctions.createStatelessCompletion({
            provider: body.model,
            turns,
            systemPrompt,
            temperature: body.temperature ?? undefined,
            maxTokens: body.max_completion_tokens ?? body.max_tokens ?? undefined,
            signal: abortController.signal,
            onChunk: stream
                ? (delta) => {
                    ensureStreamStarted();
                    if (delta !== "")
                        writeEvent(chunkBody({content: delta}, null));
                }
                : undefined
        });

        if (abortController.signal.aborted)
            return;

        if (stream) {
            ensureStreamStarted();
            writeEvent(chunkBody({}, result.finishReason));
            res.write("data: [DONE]\n\n");
            res.end();
        } else {
            sendJson(res, 200, {
                id,
                object: "chat.completion",
                created,
                model: body.model,
                choices: [{index: 0, message: {role: "assistant", content: result.text}, finish_reason: result.finishReason}]
            });
        }
    } catch (err) {
        if (abortController.signal.aborted)
            return;

        if (!streamStarted)
            throw err;

        // headers are already out, so the error can only be delivered in-band
        const message = err instanceof Error ? err.message : String(err);
        writeEvent({error: {message, type: "server_error", param: null, code: null}});
        res.write("data: [DONE]\n\n");
        res.end();
    }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

    if (path !== "/v1/models" && path !== "/v1/chat/completions")
        throw new HttpError(404, `${path} は存在しません`, "invalid_request_error", "not_found");

    if (!isAuthorized(req)) {
        throw new HttpError(
            401, "APIキーが正しくありません。Authorization: Bearer <トークン> を指定してください", "authentication_error", "invalid_api_key"
        );
    }

    if (path === "/v1/models") {
        if (req.method !== "GET")
            throw new HttpError(405, "GET のみ対応しています", "invalid_request_error");

        sendJson(res, 200, {object: "list", data: listAvailableModels()});
        return;
    }

    if (req.method !== "POST")
        throw new HttpError(405, "POST のみ対応しています", "invalid_request_error");

    await handleChatCompletions(req, res);
}

function createAndStoreToken(): string {
    const token = `sk-assistant-${crypto.randomBytes(24).toString("hex")}`;
    try {
        setStoredApiKey("openai-server", token);
    } catch (err) {
        console.error("Could not persist the OpenAI-compatible server token; it will change on the next launch", err);
    }

    return token;
}

/** The token persists across restarts (encrypted via the OS keychain) so client configs keep working; falls back to a per-run token. */
function resolveAuthToken(): string {
    return getStoredApiKey("openai-server") ?? createAndStoreToken();
}

/** Replaces the token immediately (no restart needed); clients still using the old one get 401 from the next request on. */
export function regenerateOpenAiServerToken(): OpenAiServerStatus {
    if (httpServer == null)
        throw new Error("The OpenAI-compatible server is not running");

    authToken = createAndStoreToken();
    return getOpenAiServerStatus();
}

export function getOpenAiServerStatus(): OpenAiServerStatus {
    if (httpServer == null || authToken == null)
        return {running: false};

    const address = httpServer.address();
    const port = typeof address === "object" && address != null ? address.port : undefined;

    return {running: true, port, token: authToken};
}

/** Starts the local OpenAI-compatible HTTP server (idempotent — returns the existing status if already running). */
export async function startOpenAiServer(): Promise<OpenAiServerStatus> {
    if (httpServer != null)
        return getOpenAiServerStatus();

    authToken = resolveAuthToken();

    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err: unknown) => {
            const httpError = err instanceof HttpError
                ? err
                : err instanceof ProviderUnavailableError
                    ? new HttpError(503, err.message, "server_error", "provider_unavailable")
                    : new HttpError(500, err instanceof Error ? err.message : String(err), "server_error");

            if (httpError.status === 500)
                console.error("OpenAI-compatible server request failed", err);

            if (res.headersSent)
                res.end();
            else
                sendJson(res, httpError.status, errorBody(httpError));
        });
    });
    httpServer = server;

    return await new Promise((resolve, reject) => {
        server.once("error", (err) => {
            httpServer = null;
            authToken = null;
            reject(err);
        });
        // bind to localhost only: this server must never be reachable from outside the machine
        server.listen(OPENAI_SERVER_PORT, "127.0.0.1", () => resolve(getOpenAiServerStatus()));
    });
}

/** Stops the local OpenAI-compatible HTTP server, if running. */
export async function stopOpenAiServer(): Promise<void> {
    const server = httpServer;
    httpServer = null;
    authToken = null;

    if (server != null) {
        // in-flight streaming responses would otherwise keep close() waiting indefinitely
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}
