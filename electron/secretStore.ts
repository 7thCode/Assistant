import fs from "node:fs";
import path from "node:path";
import {app, safeStorage} from "electron";

export type ApiKeyProvider = "openai" | "anthropic" | "gemini";

function getKeyFilePath(provider: ApiKeyProvider) {
    // "openai-api-key.enc" kept as-is (rather than renamed) so existing installs don't lose their stored key
    const fileName = provider === "openai" ? "openai-api-key.enc" : `${provider}-api-key.enc`;
    return path.join(app.getPath("userData"), fileName);
}

export function hasStoredApiKey(provider: ApiKeyProvider): boolean {
    return fs.existsSync(getKeyFilePath(provider));
}

export function getStoredApiKey(provider: ApiKeyProvider): string | undefined {
    const filePath = getKeyFilePath(provider);
    if (!fs.existsSync(filePath))
        return undefined;

    if (!safeStorage.isEncryptionAvailable()) {
        console.error(`Encryption is not available on this system; cannot read the stored ${provider} API key`);
        return undefined;
    }

    try {
        return safeStorage.decryptString(fs.readFileSync(filePath));
    } catch (err) {
        console.error(`Failed to decrypt the stored ${provider} API key`, err);
        return undefined;
    }
}

/** Pass an empty string to remove the stored key. */
export function setStoredApiKey(provider: ApiKeyProvider, key: string): void {
    const filePath = getKeyFilePath(provider);

    if (key === "") {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
        return;
    }

    if (!safeStorage.isEncryptionAvailable())
        throw new Error(`Encryption is not available on this system; cannot store the ${provider} API key`);

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, safeStorage.encryptString(key));
}
