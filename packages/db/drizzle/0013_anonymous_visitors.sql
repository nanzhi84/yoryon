CREATE TABLE "analytics_visitors" (
	"visitor_id" uuid PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "visitor_id" uuid;--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_time_idx" ON "analytics_events" USING btree ("visitor_id","received_at");