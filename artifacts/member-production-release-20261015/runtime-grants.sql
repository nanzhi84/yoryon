-- 0013 creates a new table. Production roles are separated from the migrator owner.
-- The API upserts first_seen_at using least(existing, excluded); it needs UPDATE, never DELETE.
GRANT SELECT, INSERT, UPDATE ON TABLE public.analytics_visitors TO yoryon_api;
-- Visitor reports read the lifetime ledger; pruning applies to analytics_events only.
GRANT SELECT ON TABLE public.analytics_visitors TO yoryon_cli;
