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

    /**
     * City-level only (derived from the machine's public IP via a third-party lookup, no OS location
     * permission involved) - not precise GPS, and this is the only static function that reaches the
     * network even when the active provider is "local".
     */
    getCurrentLocation: defineChatSessionFunction({
        description: "Get the user's approximate current location (city-level, derived from their IP address)",
        async handler() {
            try {
                // ip-api.com's free tier is HTTP-only (no HTTPS) but has a much more generous rate limit
                // than HTTPS-capable alternatives like ipapi.co, which reject most requests on a shared IP.
                const response = await fetch("http://ip-api.com/json/");
                if (!response.ok)
                    return {error: `Location lookup failed with HTTP ${response.status}`};

                const data = await response.json() as Record<string, unknown>;
                if (data.status === "fail")
                    return {error: typeof data.message === "string" ? data.message : "Location lookup failed"};

                return {
                    city: data.city,
                    region: data.regionName,
                    country: data.country,
                    latitude: data.lat,
                    longitude: data.lon,
                    timezone: data.timezone
                };
            } catch (err) {
                return {error: `Location lookup failed: ${err instanceof Error ? err.message : String(err)}`};
            }
        }
    })
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
