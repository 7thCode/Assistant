import crypto from "node:crypto";
import http from "node:http";
// the SDK's exports map uses a wildcard subpath pattern that the eslint import resolver doesn't follow,
// even though these are valid, documented import paths that resolve fine at build- and run-time
// eslint-disable-next-line import/no-unresolved
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
// eslint-disable-next-line import/no-unresolved
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {z} from "zod";
import packageJson from "../../package.json";
import {llmFunctions, llmState} from "../state/llmState.js";

export type McpServerStatus = {
    running: boolean,
    port?: number,
    token?: string
};

let httpServer: http.Server | null = null;
let mcpServer: McpServer | null = null;
let transport: StreamableHTTPServerTransport | null = null;
let authToken: string | null = null;

/** The most recent model turn's full text, read back after `send_prompt` awaits completion. */
function getLastModelResponseText(): string {
    const chat = llmState.state.chatSession.simplifiedChat;
    for (let i = chat.length - 1; i >= 0; i--) {
        const item = chat[i];
        if (item?.type === "model")
            return item.message.map((part) => part.text).join("");
    }

    return "";
}

function registerTools(server: McpServer) {
    server.registerTool("get_status", {
        description:
            "assistantアプリの現在の状態を取得する: モデルの読み込み状況、アクティブなプロバイダー、コンテキスト使用量、現在のセッションなど"
    }, async () => {
        const state = llmState.state;
        const activeSession = state.sessions.list.find((session) => session.id === state.sessions.activeSessionId);

        const status = {
            modelLoaded: state.model.loaded,
            modelName: state.model.name,
            activeProvider: state.activeProvider,
            providers: {
                openai: state.providers.openai.available,
                anthropic: state.providers.anthropic.available,
                gemini: state.providers.gemini.available
            },
            contextUsage: state.contextUsage,
            generatingResult: state.chatSession.generatingResult,
            activeSession: activeSession == null ? undefined : {id: activeSession.id, title: activeSession.title},
            sessionCount: state.sessions.list.length
        };

        return {content: [{type: "text", text: JSON.stringify(status, null, 2)}]};
    });

    server.registerTool("send_prompt", {
        description: "assistantアプリのチャットにメッセージを送信し、応答が完了するまで待って結果を返す",
        inputSchema: {message: z.string().describe("送信するメッセージ本文")}
    }, async ({message}) => {
        if (!llmState.state.chatSession.loaded) {
            return {
                content: [{type: "text", text: "チャットセッションが読み込まれていません(モデルが未読み込みの可能性があります)"}],
                isError: true
            };
        }

        await llmFunctions.chatSession.prompt(message);

        const {lastError} = llmState.state.chatSession;
        if (lastError != null)
            return {content: [{type: "text", text: lastError}], isError: true};

        return {content: [{type: "text", text: getLastModelResponseText()}]};
    });

    server.registerTool("switch_provider", {
        description: "アクティブなプロバイダーを切り替える",
        inputSchema: {provider: z.enum(["local", "auto", "openai", "anthropic", "gemini"]).describe("切り替え先のプロバイダー")}
    }, async ({provider}) => {
        llmFunctions.setActiveProvider(provider);
        return {content: [{type: "text", text: `プロバイダーを "${provider}" に切り替えました`}]};
    });

    server.registerTool("list_sessions", {
        description: "保存されている会話セッションの一覧を取得する"
    }, async () => {
        const {list, activeSessionId} = llmState.state.sessions;
        return {content: [{type: "text", text: JSON.stringify({activeSessionId, sessions: list}, null, 2)}]};
    });

    server.registerTool("new_session", {
        description: "現在の会話を保存し、新しい空の会話セッションを開始する"
    }, async () => {
        await llmFunctions.newSession();
        return {content: [{type: "text", text: `新しいセッションを開始しました (id: ${llmState.state.sessions.activeSessionId})`}]};
    });

    server.registerTool("switch_session", {
        description: "指定したidの既存の会話セッションに切り替える(idはlist_sessionsで取得できる)",
        inputSchema: {id: z.string().describe("切り替え先セッションのid")}
    }, async ({id}) => {
        if (!llmState.state.sessions.list.some((session) => session.id === id))
            return {content: [{type: "text", text: `セッション "${id}" が見つかりません`}], isError: true};

        await llmFunctions.switchSession(id);
        return {content: [{type: "text", text: `セッション "${id}" に切り替えました`}]};
    });
}

export function getMcpServerStatus(): McpServerStatus {
    if (httpServer == null || authToken == null)
        return {running: false};

    const address = httpServer.address();
    const port = typeof address === "object" && address != null ? address.port : undefined;

    return {running: true, port, token: authToken};
}

/** Starts the local MCP HTTP server (idempotent — returns the existing status if already running). */
export async function startMcpServer(): Promise<McpServerStatus> {
    if (httpServer != null)
        return getMcpServerStatus();

    authToken = crypto.randomBytes(24).toString("hex");

    mcpServer = new McpServer({name: "assistant", version: packageJson.version});
    registerTools(mcpServer);

    transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});
    await mcpServer.connect(transport);

    const server = http.createServer((req, res) => {
        if (req.url !== "/mcp") {
            res.writeHead(404).end();
            return;
        }

        if (req.headers.authorization !== `Bearer ${authToken}`) {
            res.writeHead(401, {"content-type": "application/json"}).end(JSON.stringify({error: "unauthorized"}));
            return;
        }

        if (transport == null) {
            res.writeHead(503).end();
            return;
        }

        void transport.handleRequest(req, res);
    });
    httpServer = server;

    return await new Promise((resolve, reject) => {
        server.once("error", (err) => {
            httpServer = null;
            authToken = null;
            reject(err);
        });
        // bind to localhost only: this server must never be reachable from outside the machine
        server.listen(0, "127.0.0.1", () => resolve(getMcpServerStatus()));
    });
}

/** Stops the local MCP HTTP server, if running. */
export async function stopMcpServer(): Promise<void> {
    const server = httpServer;
    httpServer = null;
    authToken = null;

    if (transport != null) {
        await transport.close();
        transport = null;
    }
    if (mcpServer != null) {
        await mcpServer.close();
        mcpServer = null;
    }
    if (server != null)
        await new Promise<void>((resolve) => server.close(() => resolve()));
}
