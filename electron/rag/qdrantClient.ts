import {QdrantClient} from "@qdrant/js-client-rest";

const collectionName = "assistant_documents";
const qdrantUrl = process.env["QDRANT_URL"] || "http://localhost:6333";

const client = new QdrantClient({url: qdrantUrl});

export type RetrievedChunk = {
    text: string,
    source: string,
    score: number
};

export type ChunkToUpsert = {
    id: string,
    vector: number[],
    text: string,
    source: string,
    chunkIndex: number
};

export async function isReachable(): Promise<boolean> {
    try {
        await client.getCollections();
        return true;
    } catch {
        return false;
    }
}

export async function ensureCollection(vectorSize: number): Promise<void> {
    const {collections} = await client.getCollections();
    if (collections.some((collection) => collection.name === collectionName))
        return;

    await client.createCollection(collectionName, {
        vectors: {
            size: vectorSize,
            distance: "Cosine"
        }
    });
}

export async function upsertChunks(chunks: ChunkToUpsert[]): Promise<void> {
    await client.upsert(collectionName, {
        wait: true,
        points: chunks.map((chunk) => ({
            id: chunk.id,
            vector: chunk.vector,
            payload: {
                text: chunk.text,
                source: chunk.source,
                chunkIndex: chunk.chunkIndex
            }
        }))
    });
}

export async function search(vector: number[], limit: number, minScore: number): Promise<RetrievedChunk[]> {
    // these field names are dictated by the Qdrant REST API
    /* eslint-disable camelcase */
    const results = await client.search(collectionName, {
        vector,
        limit,
        score_threshold: minScore,
        with_payload: true
    });
    /* eslint-enable camelcase */

    return results.map((result) => {
        const payload = result.payload as {text?: string, source?: string} | null;
        return {
            text: String(payload?.text ?? ""),
            source: String(payload?.source ?? "unknown"),
            score: result.score
        };
    });
}

export async function getDocumentCount(): Promise<number> {
    try {
        const result = await client.count(collectionName, {exact: true});
        return result.count;
    } catch {
        // the collection may not exist yet
        return 0;
    }
}

export type DocumentSummary = {
    source: string,
    chunkCount: number
};

/** Lists the distinct source documents that have been ingested, with how many chunks each contributed. */
export async function listDocuments(): Promise<DocumentSummary[]> {
    const chunkCountsBySource = new Map<string, number>();

    try {
        let offset: string | number | Record<string, unknown> | null | undefined;
        do {
            // these field names are dictated by the Qdrant REST API
            /* eslint-disable camelcase */
            const page = await client.scroll(collectionName, {
                limit: 200,
                offset,
                with_payload: ["source"],
                with_vector: false
            });
            /* eslint-enable camelcase */

            for (const point of page.points) {
                const source = String((point.payload as {source?: string} | null)?.source ?? "unknown");
                chunkCountsBySource.set(source, (chunkCountsBySource.get(source) ?? 0) + 1);
            }

            offset = page.next_page_offset ?? undefined;
        } while (offset != null);
    } catch {
        // the collection may not exist yet
        return [];
    }

    return [...chunkCountsBySource.entries()]
        .map(([source, chunkCount]) => ({source, chunkCount}))
        .sort((a, b) => a.source.localeCompare(b.source));
}

export async function deleteDocument(source: string): Promise<void> {
    await client.delete(collectionName, {
        wait: true,
        filter: {
            must: [
                {key: "source", match: {value: source}}
            ]
        }
    });
}

export async function clearCollection(): Promise<void> {
    try {
        await client.deleteCollection(collectionName);
    } catch {
        // ignore if it doesn't exist
    }
}
