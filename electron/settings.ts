import fs from "node:fs";
import path from "node:path";
import {app} from "electron";

type PersistedSettings = {
    modelDirectory?: string,
    chatModelPath?: string,
    embeddingModelPath?: string,
    openAiModel?: string
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
