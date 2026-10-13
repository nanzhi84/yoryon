CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE search_projections (
 content_id uuid PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
 revision uuid NOT NULL, title text COLLATE "C" NOT NULL, description text COLLATE "C" NOT NULL,
 body_text text COLLATE "C" NOT NULL, text_nodes jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX search_title_trgm ON search_projections USING gin(title gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX search_description_trgm ON search_projections USING gin(description gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX search_body_trgm ON search_projections USING gin(body_text gin_trgm_ops);
--> statement-breakpoint
CREATE TABLE search_epoch (id integer PRIMARY KEY CHECK(id=1), version bigint NOT NULL DEFAULT 0);
--> statement-breakpoint
INSERT INTO search_epoch(id) VALUES(1);
--> statement-breakpoint
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
CREATE TRIGGER contents_search_changed AFTER INSERT OR DELETE OR UPDATE OF body_markdown,title,description,status,visibility,revision,published_at ON contents
 FOR EACH ROW EXECUTE FUNCTION invalidate_search_projection();
--> statement-breakpoint
CREATE TABLE search_sessions (
 id uuid PRIMARY KEY, identity text NOT NULL, network text NOT NULL, request_id uuid NOT NULL,
 query_hash text NOT NULL, query_cipher text NOT NULL, epoch bigint NOT NULL, results jsonb NOT NULL,
 metered boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 UNIQUE(identity, request_id)
);
--> statement-breakpoint
CREATE INDEX search_quota_identity ON search_sessions(identity,created_at) WHERE metered;
--> statement-breakpoint
CREATE INDEX search_quota_network ON search_sessions(network,created_at) WHERE metered;
--> statement-breakpoint
CREATE INDEX search_sessions_expiry ON search_sessions(expires_at);
