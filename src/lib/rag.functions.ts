// Server functions for managing and querying the RAG knowledge base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedText, retrieveKnowledge } from "./rag.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SEED_KNOWLEDGE } from "./rag-seed";

const ChunkInput = z.object({
  source: z.string().min(1).max(120),
  title: z.string().max(200).optional(),
  content: z.string().min(20).max(8000),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Ingest chunks (authenticated; meant for admin/seeding use).
export const ingestKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ chunks: z.array(ChunkInput).min(1).max(50) }))
  .handler(async ({ data }) => {
    const embeddings = await embedText(data.chunks.map((c) => c.content));
    const rows = data.chunks.map((c, i) => ({
      source: c.source,
      title: c.title ?? null,
      content: c.content,
      metadata: (c.metadata ?? {}) as never,
      embedding: embeddings[i] as unknown as string,
    }));
    const { error, count } = await supabaseAdmin
      .from("knowledge_chunks")
      .insert(rows, { count: "exact" });
    if (error) throw new Error(`Insert failed: ${error.message}`);
    return { inserted: count ?? rows.length };
  });

// One-shot seeding from the bundled SEED_KNOWLEDGE list.
export const seedKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    await supabaseAdmin.from("knowledge_chunks").delete().like("source", "seed:%");
    const embeddings = await embedText(SEED_KNOWLEDGE.map((c) => c.content));
    const rows = SEED_KNOWLEDGE.map((c, i) => ({
      source: c.source,
      title: c.title,
      content: c.content,
      metadata: (c.metadata ?? {}) as never,
      embedding: embeddings[i] as unknown as string,
    }));
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert(rows);
    if (error) throw new Error(`Seed failed: ${error.message}`);
    return { inserted: rows.length };
  });

// Public query — useful for "ask the knowledge base" surfaces.
export const queryKnowledge = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      query: z.string().min(3).max(500),
      matchCount: z.number().min(1).max(12).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const chunks = await retrieveKnowledge(data.query, {
      matchCount: data.matchCount,
    });
    return {
      chunks: chunks.map((c) => ({
        id: c.id,
        source: c.source,
        title: c.title,
        content: c.content,
        similarity: c.similarity,
      })),
    };
  });

