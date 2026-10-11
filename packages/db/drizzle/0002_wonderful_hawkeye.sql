CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"placement" text,
	"page_view_id" uuid NOT NULL,
	"session_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_events_event_id_unique" ON "analytics_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_target_time_idx" ON "analytics_events" USING btree ("target_kind","target_id","received_at");--> statement-breakpoint
CREATE INDEX "analytics_events_received_at_idx" ON "analytics_events" USING btree ("received_at");