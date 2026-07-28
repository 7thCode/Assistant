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
    mcpServers?: PersistedMcpServer[],
    localTemperature?: number,
    localContextSize?: number
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
