CREATE TABLE "player_story_grants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_story_grants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"grant_key" text NOT NULL,
	"game_row_id" integer,
	"grant_category" text NOT NULL,
	"is_superseded" boolean DEFAULT false NOT NULL,
	"awarded_at_chapter" integer NOT NULL,
	"flag_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_grants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_grants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"grant_key" text NOT NULL,
	"display_name" text NOT NULL,
	"flavour_text" text,
	"chapter_trigger" integer NOT NULL,
	"flag_condition" text,
	"grant_category" text NOT NULL,
	"grant_payload" jsonb NOT NULL,
	"upgrade_of" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "story_grants_grant_key_unique" UNIQUE("grant_key")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "gold" SET DEFAULT 500;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "hp" SET DEFAULT 200;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "max_hp" SET DEFAULT 200;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "attack" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "defense" SET DEFAULT 20;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "str" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "agi" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "vit" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "int" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "dex" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "luk" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "dialogue_lines" ADD COLUMN "grant_hint_key" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "passive_description" text;--> statement-breakpoint
ALTER TABLE "story_scenes" ADD COLUMN "conditional_variants" jsonb;--> statement-breakpoint
ALTER TABLE "story_scenes" ADD COLUMN "flag_writes" jsonb;--> statement-breakpoint
CREATE INDEX "player_story_grants_user_id_idx" ON "player_story_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_story_grants_user_grant_idx" ON "player_story_grants" USING btree ("user_id","grant_key");--> statement-breakpoint
CREATE INDEX "story_grants_chapter_trigger_idx" ON "story_grants" USING btree ("chapter_trigger");--> statement-breakpoint
CREATE INDEX "story_grants_grant_key_idx" ON "story_grants" USING btree ("grant_key");--> statement-breakpoint
CREATE INDEX "campaign_events_user_id_idx" ON "campaign_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cards_user_id_idx" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cards_equipment_id_idx" ON "cards" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "chronicle_entries_user_id_idx" ON "chronicle_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "companions_user_id_idx" ON "companions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "equipment_user_id_idx" ON "equipment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "held_provinces_user_id_idx" ON "held_provinces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "horses_user_id_idx" ON "horses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pets_user_id_idx" ON "pets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_earned_titles_user_id_idx" ON "player_earned_titles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_flags_user_id_idx" ON "player_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_story_progress_user_id_idx" ON "player_story_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transformations_user_id_idx" ON "transformations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_quests_user_id_idx" ON "user_quests" USING btree ("user_id");
