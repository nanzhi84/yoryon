import { z } from "zod";

// Public, bounded geometry only: never include text, media identifiers or URLs.
export const readerLayoutSchema = z.array(z.object({
  kind: z.enum(["paragraph", "heading", "list", "quote", "code", "media", "summary", "rule"]),
  lengths: z.array(z.number().min(0).max(4000)).max(12),
  level: z.number().int().min(1).max(6).optional(),
})).max(12);
export type ReaderLayout = z.infer<typeof readerLayoutSchema>;
