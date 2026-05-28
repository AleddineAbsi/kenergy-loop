// Server-only RAG helpers: embed text via Lovable AI Gateway and retrieve
// the most relevant knowledge chunks from pgvector.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims — matches knowledge_chunks.embedding

export async function embedText(input: string | string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Embedding gateway failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const data = (json?.data ?? []) as Array<{ embedding: number[] }>;
  return data.map((d) => d.embedding);
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
