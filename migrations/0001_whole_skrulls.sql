CREATE TABLE "chronicle_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chronicle_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"entry_key" text NOT NULL,
	"headline" text NOT NULL,
	"detail" text,
	"flag_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"chapter_number" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_earned_titles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_earned_titles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"title_id" integer NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_titles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_titles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"earn_condition" text,
	"rarity" text DEFAULT 'common' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "player_titles_title_key_unique" UNIQUE("title_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_title_id" integer;