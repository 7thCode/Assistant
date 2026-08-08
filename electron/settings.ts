import fs from "node:fs";
import path from "node:path";
import {app} from "electron";

export type PersistedMcpServer = {
    name: string,
    command: string,
    args: string[],
    enabled: boolean
};

type PersistedSettings = {
    modelDirectory?: string,
    chatModelPath?: string,
    embeddingModelPath?: string,
    openAiModel?: string,
    anthropicModel?: string,
    geminiModel?: string,
    mcpServers?: PersistedMcpServer[],
    localTemperature?: number,
    localContextSize?: number,
    systemPrompt?: string,
    activeSessionId?: string,
    /** Which cloud provider "Auto" mode escalates to; kept in sync with whichever cloud provider was last selected manually. */
    lastCloudProvider?: "openai" | "anthropic" | "gemini",
    /** Lifetime count of completed turns handled by each provider, across all sessions. */
    usageStats?: UsageStats,
    /** Whether the local MCP server (lets external MCP clients control this app) should start on launch. */
    mcpServerEnabled?: boolean
};

export type UsageStats = {
    local: number,
    openai: number,
    anthropic: number,
    gemini: number
};

function getSettingsFilePath() {
    return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): PersistedSettings {
    try {
        return JSON.parse(fs.readFileSync(getSettingsFilePath(), "utf-8")) as PersistedSettings;
    } catch {
        return {};
    }
}

function writeSettings(settings: PersistedSettings): void {
    const filePath = getSettingsFilePath();
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

/** The user-configured model directory, if any was explicitly set via Settings. */
export function getConfiguredModelDirectory(): string | undefined {
    return readSettings().modelDirectory;
}

export function setConfiguredModelDirectory(dirPath: string): void {
    writeSettings({...readSettings(), modelDirectory: dirPath});
}

/** The user-selected local chat model file, if any was chosen via the header's select button. */
export function getConfiguredChatModelPath(): string | undefined {
    return readSettings().chatModelPath;
}

export function setConfiguredChatModelPath(modelPath: string): void {
    writeSettings({...readSettings(), chatModelPath: modelPath});
}

/** The user-selected RAG embedding model file, if any was chosen via Settings. */
export function getConfiguredEmbeddingModelPath(): string | undefined {
    return readSettings().embeddingModelPath;
}

export function setConfiguredEmbeddingModelPath(modelPath: string): void {
    writeSettings({...readSettings(), embeddingModelPath: modelPath});
}

/** The user-configured OpenAI model ID, if any was set via Settings. Pass `""` to clear it. */
export function getConfiguredOpenAiModel(): string | undefined {
    return readSettings().openAiModel;
}

export function setConfiguredOpenAiModel(model: string): void {
    const settings = readSettings();
    if (model === "")
        delete settings.openAiModel;
    else
        settings.openAiModel = model;

    writeSettings(settings);
}

/** The user-configured Anthropic (Claude) model ID, if any was set via Settings. Pass `""` to clear it. */
export function getConfiguredAnthropicModel(): string | undefined {
    return readSettings().anthropicModel;
}

export function setConfiguredAnthropicModel(model: string): void {
    const settings = readSettings();
    if (model === "")
        delete settings.anthropicModel;
    else
        settings.anthropicModel = model;

    writeSettings(settings);
}

/** The user-configured Gemini model ID, if any was set via Settings. Pass `""` to clear it. */
export function getConfiguredGeminiModel(): string | undefined {
    return readSettings().geminiModel;
}

export function setConfiguredGeminiModel(model: string): void {
    const settings = readSettings();
    if (model === "")
        delete settings.geminiModel;
    else
        settings.geminiModel = model;

    writeSettings(settings);
}

/** Which cloud provider "Auto" mode escalates to, updated whenever the user manually picks a cloud provider. */
export function getConfiguredLastCloudProvider(): "openai" | "anthropic" | "gemini" | undefined {
    return readSettings().lastCloudProvider;
}

export function setConfiguredLastCloudProvider(provider: "openai" | "anthropic" | "gemini"): void {
    writeSettings({...readSettings(), lastCloudProvider: provider});
}

/** The user-configured MCP servers, in the order they were added. */
export function getConfiguredMcpServers(): PersistedMcpServer[] {
    return readSettings().mcpServers ?? [];
}

export function setConfiguredMcpServers(servers: PersistedMcpServer[]): void {
    writeSettings({...readSettings(), mcpServers: servers});
}

/** The local model's sampling temperature. Defaults to `0` (deterministic/greedy), matching node-llama-cpp's own default. */
export function getConfiguredLocalTemperature(): number {
    return readSettings().localTemperature ?? 0;
}

export function setConfiguredLocalTemperature(temperature: number): void {
    writeSettings({...readSettings(), localTemperature: temperature});
}

/** The local model's context size, applied the next time it's loaded. `undefined` lets node-llama-cpp pick automatically. */
export function getConfiguredLocalContextSize(): number | undefined {
    return readSettings().localContextSize;
}

/** Pass `undefined` to reset to automatic sizing. */
export function setConfiguredLocalContextSize(contextSize: number | undefined): void {
    const settings = readSettings();
    if (contextSize == null)
        delete settings.localContextSize;
    else
        settings.localContextSize = contextSize;

    writeSettings(settings);
}

/**
 * The system prompt sent with every conversation, across the local model and all cloud providers.
 * Applied the next time a chat session is created (existing conversations keep whatever was baked in
 * when they started). `undefined`/`""` means no system prompt.
 */
export function getConfiguredSystemPrompt(): string | undefined {
    return readSettings().systemPrompt;
}

/** Pass `""` to clear it. */
export function setConfiguredSystemPrompt(prompt: string): void {
    const settings = readSettings();
    if (prompt === "")
        delete settings.systemPrompt;
    else
        settings.systemPrompt = prompt;

    writeSettings(settings);
}

/** The session that was active when the app was last used, resumed on the next startup. */
export function getConfiguredActiveSessionId(): string | undefined {
    return readSettings().activeSessionId;
}

export function setConfiguredActiveSessionId(id: string): void {
    writeSettings({...readSettings(), activeSessionId: id});
}

/** Lifetime count of completed turns handled by each provider, across all sessions. */
export function getConfiguredUsageStats(): UsageStats {
    const stats = readSettings().usageStats;
    return {
        local: stats?.local ?? 0,
        openai: stats?.openai ?? 0,
        anthropic: stats?.anthropic ?? 0,
        gemini: stats?.gemini ?? 0
    };
}

/** Increments the lifetime count for the given provider by one and returns the updated totals. */
export function incrementConfiguredUsageStat(provider: keyof UsageStats): UsageStats {
    const settings = readSettings();
    const stats = getConfiguredUsageStats();
    stats[provider] += 1;
    settings.usageStats = stats;
    writeSettings(settings);
    return stats;
}

/** Whether the local MCP server should be running. Defaults to `false` (opt-in). */
export function getConfiguredMcpServerEnabled(): boolean {
    return readSettings().mcpServerEnabled ?? false;
}

export function setConfiguredMcpServerEnabled(enabled: boolean): void {
    writeSettings({...readSettings(), mcpServerEnabled: enabled});
}

/**
 * The directory to default file-picker dialogs to: the user's explicit choice if set,
 * otherwise `./models` next to the app when running from a dev checkout (and it exists).
 */
export function resolveModelDirectory(): string | undefined {
    const configured = getConfiguredModelDirectory();
    if (configured != null && fs.existsSync(configured))
        return configured;

    const devDefault = path.join(process.cwd(), "models");
    if (fs.existsSync(devDefault))
        return devDefault;

    return undefined;
}
