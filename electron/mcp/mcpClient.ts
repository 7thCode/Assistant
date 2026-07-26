// the SDK's exports map uses a wildcard subpath pattern that the eslint import resolver doesn't follow,
// even though these are valid, documented import paths that resolve fine at build- and run-time
// eslint-disable-next-line import/no-unresolved
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
// eslint-disable-next-line import/no-unresolved
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import type {CallToolResult, Tool as McpToolSchema} from "@modelcontextprotocol/sdk/types.js";

export type McpServerConfig = {
    name: string,
    command: string,
    args: string[]
};

export type McpToolInfo = {
    /** Unique across all connected servers; what the model actually sees and calls. */
    qualifiedName: string,
    serverName: string,
    toolName: string,
    description?: string,
    inputSchema: McpToolSchema["inputSchema"]
};

type ConnectedServer = {
    config: McpServerConfig,
    client: Client,
    tools: McpToolSchema[]
};

const qualifiedNameSeparator = "__";

const connectedServers = new Map<string, ConnectedServer>();
const connectionErrors = new Map<string, string>();
/** qualifiedName -> {serverName, toolName}, kept in sync with `connectedServers` to avoid re-parsing qualified names. */
const toolLookup = new Map<string, {serverName: string, toolName: string}>();

function removeServerFromToolLookup(serverName: string) {
    for (const [qualifiedName, tool] of toolLookup)
        if (tool.serverName === serverName)
            toolLookup.delete(qualifiedName);
}

export async function connectServer(config: McpServerConfig): Promise<void> {
    await disconnectServer(config.name);
    connectionErrors.delete(config.name);

    const client = new Client({name: "assistant", version: "1.0.0"});
    const transport = new StdioClientTransport({command: config.command, args: config.args});

    try {
        await client.connect(transport);
        const {tools} = await client.listTools();

        connectedServers.set(config.name, {config, client, tools});
        for (const tool of tools)
            toolLookup.set(`${config.name}${qualifiedNameSeparator}${tool.name}`, {serverName: config.name, toolName: tool.name});
    } catch (err) {
        connectionErrors.set(config.name, err instanceof Error ? err.message : String(err));
        throw err;
    }
}

export async function disconnectServer(name: string): Promise<void> {
    const server = connectedServers.get(name);
    if (server == null)
        return;

    try {
        await server.client.close();
    } catch (err) {
        console.error(`Failed to close MCP server "${name}"`, err);
    }

    connectedServers.delete(name);
    removeServerFromToolLookup(name);
}

export async function disconnectAllServers(): Promise<void> {
    await Promise.all([...connectedServers.keys()].map(disconnectServer));
}

export function isServerConnected(name: string): boolean {
    return connectedServers.has(name);
}

export function getConnectionError(name: string): string | undefined {
    return connectionErrors.get(name);
}

export function listAllTools(): McpToolInfo[] {
    const result: McpToolInfo[] = [];

    for (const server of connectedServers.values()) {
        for (const tool of server.tools) {
            result.push({
                qualifiedName: `${server.config.name}${qualifiedNameSeparator}${tool.name}`,
                serverName: server.config.name,
                toolName: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            });
        }
    }

    return result;
}

export async function callTool(qualifiedName: string, args: Record<string, unknown>): Promise<string> {
    const lookup = toolLookup.get(qualifiedName);
    if (lookup == null)
        throw new Error(`Unknown tool "${qualifiedName}"`);

    const server = connectedServers.get(lookup.serverName);
    if (server == null)
        throw new Error(`MCP server "${lookup.serverName}" is not connected`);

    const result = await server.client.callTool({name: lookup.toolName, arguments: args}) as CallToolResult;
    const text = (result.content ?? [])
        .map((block) => (block.type === "text" ? block.text : `[${block.type} content omitted]`))
        .join("\n");

    return result.isError ? `Error: ${text}` : text;
}
