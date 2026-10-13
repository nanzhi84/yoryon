CREATE OR REPLACE FUNCTION invalidate_search_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   DELETE FROM search_projections WHERE content_id=OLD.id;
 ELSIF TG_OP = 'UPDATE' THEN
   IF NEW.status <> 'published' OR OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
      OR OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description THEN
     DELETE FROM search_projections WHERE content_id=OLD.id;
   ELSE
     -- Cache refresh / collection and embedded-work invalidation only rotate
     -- revision. Embedded text is excluded, so the rendered search text is unchanged.
     UPDATE search_projections SET revision=NEW.revision WHERE content_id=NEW.id AND revision=OLD.revision;
   END IF;
 END IF;
 UPDATE search_epoch SET version=version+1 WHERE id=1;
 RETURN NULL;
END; $$;
--> statement-breakpoint
