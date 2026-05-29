// Server-only RAG helpers. The demo no longer depends on an external
// embedding gateway; this deterministic local embedder keeps the knowledge
// table utilities usable without another provider key.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_DIMS = 1536;

function localEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBED_DIMS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    const index = hash.readUInt32BE(0) % EMBED_DIMS;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export async function embedText(input: string | string[]): Promise<number[][]> {
  const values = Array.isArray(input) ? input : [input];
  return values.map(localEmbedding);
}

export type KnowledgeChunk = {
  id: string;
  source: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export async function retrieveKnowledge(
  query: string,
  opts: { matchCount?: number; minSimilarity?: number } = {},
): Promise<KnowledgeChunk[]> {
  const [embedding] = await embedText(query);
  const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
    query_embedding: embedding as unknown as string,
    match_count: opts.matchCount ?? 6,
    min_similarity: opts.minSimilarity ?? 0.3,
  });
  if (error) {
    console.error("retrieveKnowledge failed:", error);
    return [];
  }
  return (data ?? []) as KnowledgeChunk[];
}

export function formatChunksForPrompt(chunks: KnowledgeChunk[]): string {
  if (!chunks.length) return "(no knowledge base matches)";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title ?? c.source} (source: ${c.source}, score ${c.similarity.toFixed(2)})\n${c.content}`,
    )
    .join("\n\n");
}
