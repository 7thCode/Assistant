import path from "node:path";
import {app} from "electron";
import * as lancedb from "@lancedb/lancedb";

const tableName = "documents";

let dbPromise: Promise<lancedb.Connection> | null = null;

function getDb(): Promise<lancedb.Connection> {
    if (dbPromise == null)
        dbPromise = lancedb.connect(path.join(app.getPath("userData"), "vectordb"));

    return dbPromise;
}

async function openExistingTable(): Promise<lancedb.Table | undefined> {
    const db = await getDb();
    const names = await db.tableNames();
    if (!names.includes(tableName))
        return undefined;

    return await db.openTable(tableName);
}

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
        await getDb();
        return true;
    } catch {
        return false;
    }
}

/** Creates the table on the first call (inferring its schema from `chunks`), and upserts by `id` on every call after that. */
export async function upsertChunks(chunks: ChunkToUpsert[]): Promise<void> {
    if (chunks.length === 0)
        return;

    const db = await getDb();
    const names = await db.tableNames();
    const rows = chunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        text: chunk.text,
        source: chunk.source,
        chunkIndex: chunk.chunkIndex
    }));

    if (!names.includes(tableName)) {
        await db.createTable(tableName, rows);
        return;
    }

    const table = await db.openTable(tableName);
    await table.mergeInsert("id")
        .whenMatchedUpdateAll()
        .whenNotMatchedInsertAll()
        .execute(rows);
}

export async function search(vector: number[], limit: number, minScore: number): Promise<RetrievedChunk[]> {
    const table = await openExistingTable();
    if (table == null)
        return [];

    const rows = await table.vectorSearch(vector)
        .distanceType("cosine")
        .limit(limit)
        .toArray();

    return rows
        .map((row): RetrievedChunk => ({
            text: String(row.text ?? ""),
            source: String(row.source ?? "unknown"),
            // LanceDB returns a cosine _distance_ (0 = identical); Qdrant-style callers expect a
            // similarity _score_ (1 = identical), so convert to keep `minScore` semantics unchanged.
            score: 1 - Number(row._distance)
        }))
        .filter((chunk) => chunk.score >= minScore);
}

export async function getDocumentCount(): Promise<number> {
    const table = await openExistingTable();
    if (table == null)
        return 0;

    return await table.countRows();
}

export type DocumentSummary = {
    source: string,
    chunkCount: number
};

/** Lists the distinct source documents that have been ingested, with how many chunks each contributed. */
export async function listDocuments(): Promise<DocumentSummary[]> {
    const table = await openExistingTable();
    if (table == null)
        return [];

    const rows = await table.query()
        .select(["source"])
        .toArray();

    const chunkCountsBySource = new Map<string, number>();
    for (const row of rows) {
        const source = String(row.source ?? "unknown");
        chunkCountsBySource.set(source, (chunkCountsBySource.get(source) ?? 0) + 1);
    }

    return [...chunkCountsBySource.entries()]
        .map(([source, chunkCount]) => ({source, chunkCount}))
        .sort((a, b) => a.source.localeCompare(b.source));
}

export async function deleteDocument(source: string): Promise<void> {
    const table = await openExistingTable();
    if (table == null)
        return;

    // LanceDB's `delete` predicate is a SQL expression, so the value has to be embedded (and quoted) into it directly
    await table.delete(`source = '${source.replace(/'/g, "''")}'`);
}

export async function clearCollection(): Promise<void> {
    const db = await getDb();
    const names = await db.tableNames();
    if (names.includes(tableName))
        await db.dropTable(tableName);
}
