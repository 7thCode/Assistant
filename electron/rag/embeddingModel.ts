import path from "node:path";
import {getLlama, Llama, LlamaModel, LlamaEmbeddingContext, type Token} from "node-llama-cpp";

let llama: Llama | null = null;
let model: LlamaModel | null = null;
let embeddingContext: LlamaEmbeddingContext | null = null;
let loadedModelPath: string | null = null;

export function isEmbeddingModelLoaded() {
    return embeddingContext != null;
}

export function getLoadedEmbeddingModelName(): string | undefined {
    return loadedModelPath != null
        ? path.basename(loadedModelPath)
        : undefined;
}

export function getEmbeddingVectorSize(): number {
    if (model == null)
        throw new Error("Embedding model is not loaded");

    return model.embeddingVectorSize;
}

/** Tokenizes text using the embedding model's own tokenizer, so chunk sizes can be measured accurately. */
export function tokenizeText(text: string): Token[] {
    if (model == null)
        throw new Error("Embedding model is not loaded");

    return model.tokenize(text);
}

export function detokenizeTokens(tokens: Token[]): string {
    if (model == null)
        throw new Error("Embedding model is not loaded");

    return model.detokenize(tokens);
}

/**
 * The largest number of tokens that's safe to embed at once, leaving headroom for the
 * "query: "/"passage: " prefix and any special tokens the model adds.
 */
export function getMaxTokensPerChunk(): number {
    if (model == null)
        throw new Error("Embedding model is not loaded");

    return Math.max(32, model.trainContextSize - 16);
}

export async function loadEmbeddingModel(modelPath: string): Promise<void> {
    if (embeddingContext != null) {
        await embeddingContext.dispose();
        embeddingContext = null;
    }
    if (model != null) {
        await model.dispose();
        model = null;
    }

    if (llama == null)
        llama = await getLlama();

    model = await llama.loadModel({modelPath});
    embeddingContext = await model.createEmbeddingContext();
    loadedModelPath = modelPath;
}

async function embed(text: string): Promise<number[]> {
    if (embeddingContext == null)
        throw new Error("Embedding model is not loaded");

    const embedding = await embeddingContext.getEmbeddingFor(text);
    return [...embedding.vector];
}

/** e5-family embedding models expect queries to be prefixed this way for best retrieval quality */
export function embedQuery(text: string): Promise<number[]> {
    return embed(`query: ${text}`);
}

/** e5-family embedding models expect indexed passages to be prefixed this way for best retrieval quality */
export function embedPassage(text: string): Promise<number[]> {
    return embed(`passage: ${text}`);
}
