import type {Token} from "node-llama-cpp";

export type Chunk = {
    text: string,
    index: number
};

export type ChunkTextOptions = {
    tokenize(text: string): Token[],
    detokenize(tokens: Token[]): string,
    /** Maximum tokens per chunk; must not exceed what the embedding model can actually process. */
    maxTokens: number,
    /** Defaults to 20% of `maxTokens`. */
    overlapTokens?: number
};

/**
 * Splits text into chunks measured in the embedding model's own tokens (not characters), so a chunk
 * can never end up longer than the model's context window regardless of the language/script used.
 */
export function chunkText(text: string, options: ChunkTextOptions): Chunk[] {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (normalized === "")
        return [];

    const {tokenize, detokenize, maxTokens} = options;
    const overlapTokens = options.overlapTokens ?? Math.floor(maxTokens * 0.2);

    const tokens = tokenize(normalized);
    if (tokens.length === 0)
        return [];

    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;
    while (start < tokens.length) {
        const end = Math.min(start + maxTokens, tokens.length);
        const chunkText = detokenize(tokens.slice(start, end)).trim();
        if (chunkText !== "")
            chunks.push({text: chunkText, index: index++});

        if (end >= tokens.length)
            break;

        start = end - overlapTokens;
    }

    return chunks;
}
