import {defineChatSessionFunction, type ChatSessionModelFunction, type ChatSessionModelFunctions} from "node-llama-cpp";
import {callTool, listAllTools} from "../mcp/mcpClient.js";
import {jsonSchemaToGbnf} from "../mcp/jsonSchemaToGbnf.js";

const staticModelFunctions = {
    // getDate: defineChatSessionFunction({
    //     description: "Get the current date",
    //     handler() {
    //         const date = new Date();
    //         return [
    //             date.getFullYear(),
    //             String(date.getMonth() + 1).padStart(2, "0"),
    //             String(date.getDate()).padStart(2, "0")
    //         ].join("-");
    //     }
    // }),
    //
    // getTime: defineChatSessionFunction({
    //     description: "Get the current time",
    //     handler() {
    //         return new Date().toLocaleTimeString("en-US");
    //     }
    // })
    //
    // getWeather: defineChatSessionFunction({
    //     description: "Get the current weather for a given location",
    //     params: {
    //         type: "object",
    //         properties: {
    //             location: {
    //                 type: "string"
    //             }
    //         }
    //     },
    //     handler({location}) {
    //         return {
    //             location,
    //             unit: "celsius",
    //             temperature: 35
    //         };
    //     }
    // })
} as const satisfies ChatSessionModelFunctions;

/**
 * Combines the static built-in functions with the tools currently exposed by connected MCP servers.
 * Built fresh on every call since MCP servers can connect/disconnect at runtime.
 */
export function getModelFunctions(): ChatSessionModelFunctions {
    const mcpFunctions: Record<string, ChatSessionModelFunction<any>> = {};

    for (const tool of listAllTools()) {
        // the JSON Schema -> GBNF conversion crosses two independently-typed schema systems;
        // the runtime shape (an object matching the MCP tool's inputSchema) is always correct.
        mcpFunctions[tool.qualifiedName] = defineChatSessionFunction<any, any>({
            description: tool.description,
            params: jsonSchemaToGbnf(tool.inputSchema) as any,
            async handler(params: Record<string, unknown>) {
                return await callTool(tool.qualifiedName, params);
            }
        });
    }

    return {...staticModelFunctions, ...mcpFunctions};
}
