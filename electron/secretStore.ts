import fs from "node:fs";
import path from "node:path";
import {app, safeStorage} from "electron";

function getKeyFilePath() {
    return path.join(app.getPath("userData"), "openai-api-key.enc");
}

export function hasStoredOpenAiApiKey(): boolean {
    return fs.existsSync(getKeyFilePath());
}

export function getStoredOpenAiApiKey(): string | undefined {
    const filePath = getKeyFilePath();
    if (!fs.existsSync(filePath))
        return undefined;

    if (!safeStorage.isEncryptionAvailable()) {
        console.error("Encryption is not available on this system; cannot read the stored OpenAI API key");
        return undefined;
    }

    try {
        return safeStorage.decryptString(fs.readFileSync(filePath));
    } catch (err) {
        console.error("Failed to decrypt the stored OpenAI API key", err);
        return undefined;
    }
}

/** Pass an empty string to remove the stored key. */
export function setStoredOpenAiApiKey(key: string): void {
    const filePath = getKeyFilePath();

    if (key === "") {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
        return;
    }

    if (!safeStorage.isEncryptionAvailable())
        throw new Error("Encryption is not available on this system; cannot store the OpenAI API key");

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, safeStorage.encryptString(key));
}
