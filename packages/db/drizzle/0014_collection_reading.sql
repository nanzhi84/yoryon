ALTER TABLE "collections" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "show_in_home" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Preserve the old feed's public-only presence, including public collection chapters.
-- Newly published standalone works use the new independent setting in the publishing code.
UPDATE contents SET show_in_home = (visibility = 'public');
--> statement-breakpoint
-- Existing collections start from their real latest content modification, never just publication date.
UPDATE collections AS coll
SET updated_at = greatest(coll.updated_at, latest.updated_at)
FROM (SELECT ci.collection_id, max(c.updated_at) AS updated_at
      FROM collection_items ci JOIN contents c ON c.id = ci.content_id
      GROUP BY ci.collection_id) AS latest
WHERE coll.id = latest.collection_id;
