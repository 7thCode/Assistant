import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {chunkText} from "./chunking.js";
import {detokenizeTokens, embedPassage, getMaxTokensPerChunk, isEmbeddingModelLoaded, tokenizeText} from "./embeddingModel.js";
import {upsertChunks} from "./lancedbClient.js";

const supportedExtensions = new Set([".txt", ".md"]);

export function isSupportedDocumentFile(filePath: string): boolean {
    return supportedExtensions.has(path.extname(filePath).toLowerCase());
}

export async function ingestFile(filePath: string): Promise<{chunksAdded: number}> {
    if (!isEmbeddingModelLoaded())
        throw new Error("Embedding model is not loaded");
    if (!isSupportedDocumentFile(filePath))
        throw new Error(`Unsupported file type: ${path.extname(filePath)}`);

    const text = await fs.readFile(filePath, "utf-8");
    const chunks = chunkText(text, {
        tokenize: tokenizeText,
        detokenize: detokenizeTokens,
        maxTokens: getMaxTokensPerChunk()
    });
    if (chunks.length === 0)
        return {chunksAdded: 0};

    const source = path.basename(filePath);
    const points = [];
    for (const chunk of chunks) {
        const vector = await embedPassage(chunk.text);
        points.push({
            id: crypto.randomUUID(),
            vector,
            text: chunk.text,
            source,
            chunkIndex: chunk.index
        });
    }

    await upsertChunks(points);

    return {chunksAdded: points.length};
}
