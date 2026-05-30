// Server functions for managing and querying the RAG knowledge base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { retrieveKnowledge } from "./rag.server";

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

