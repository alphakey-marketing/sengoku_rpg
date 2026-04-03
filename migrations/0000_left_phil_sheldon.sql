CREATE TABLE "campaign_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"event_key" text NOT NULL,
	"choice" text,
	"is_triggered" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"effect_description" text NOT NULL,
	"stats" text,
	"rarity" text NOT NULL,
	"equipment_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "companions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"exp_to_next" integer DEFAULT 100 NOT NULL,
	"hp" integer DEFAULT 50 NOT NULL,
	"max_hp" integer DEFAULT 50 NOT NULL,
	"attack" integer NOT NULL,
	"defense" integer NOT NULL,
	"speed" integer DEFAULT 10 NOT NULL,
	"dex" integer DEFAULT 10 NOT NULL,
	"agi" integer DEFAULT 10 NOT NULL,
	"skill" text,
	"is_in_party" boolean DEFAULT false NOT NULL,
	"is_special" boolean DEFAULT false NOT NULL,
	"flag_unlock_condition" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dialogue_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dialogue_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"scene_id" integer NOT NULL,
	"speaker_name" text DEFAULT 'Narrator' NOT NULL,
	"speaker_side" text DEFAULT 'none' NOT NULL,
	"portrait_key" text,
	"text" text NOT NULL,
	"line_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "equipment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text DEFAULT 'white' NOT NULL,
	"weapon_type" text,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"exp_to_next" integer DEFAULT 100 NOT NULL,
	"attack_bonus" integer DEFAULT 0 NOT NULL,
	"defense_bonus" integer DEFAULT 0 NOT NULL,
	"speed_bonus" integer DEFAULT 0 NOT NULL,
	"hp_bonus" integer DEFAULT 0 NOT NULL,
	"mdef_bonus" integer DEFAULT 0 NOT NULL,
	"flee_bonus" integer DEFAULT 0 NOT NULL,
	"matk_bonus" integer DEFAULT 0 NOT NULL,
	"crit_chance" integer DEFAULT 0 NOT NULL,
	"crit_damage" integer DEFAULT 0 NOT NULL,
	"endowment_points" integer DEFAULT 0 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"equipped_to_id" integer,
	"equipped_to_type" text,
	"card_slots" integer DEFAULT 0 NOT NULL,
	"story_flag_requirement" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "held_provinces" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "held_provinces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"location_id" integer NOT NULL,
	"boss_defeated" boolean DEFAULT false NOT NULL,
	"held_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "horses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"rarity" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"speed_bonus" integer DEFAULT 10 NOT NULL,
	"attack_bonus" integer DEFAULT 0 NOT NULL,
	"defense_bonus" integer DEFAULT 0 NOT NULL,
	"skill" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"exp_to_next" integer DEFAULT 100 NOT NULL,
	"hp" integer DEFAULT 30 NOT NULL,
	"max_hp" integer DEFAULT 30 NOT NULL,
	"attack" integer DEFAULT 5 NOT NULL,
	"defense" integer DEFAULT 5 NOT NULL,
	"speed" integer DEFAULT 15 NOT NULL,
	"skill" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_flags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"flag_key" text NOT NULL,
	"flag_value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_story_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_story_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"chapter_id" integer NOT NULL,
	"current_scene_id" integer,
	"is_completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "story_chapters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_chapters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"subtitle" text,
	"chapter_order" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"first_scene_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "story_choices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_choices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"scene_id" integer NOT NULL,
	"choice_text" text NOT NULL,
	"next_scene_id" integer NOT NULL,
	"flag_key" text,
	"flag_value" integer,
	"flag_key2" text,
	"flag_value2" integer,
	"choice_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_endings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_endings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"chapter_id" integer NOT NULL,
	"ending_key" text NOT NULL,
	"ending_title" text NOT NULL,
	"ending_description" text,
	"unlocked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "story_scenes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "story_scenes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chapter_id" integer NOT NULL,
	"background_key" text DEFAULT 'default' NOT NULL,
	"bgm_key" text DEFAULT 'bgm_default' NOT NULL,
	"scene_order" integer DEFAULT 0 NOT NULL,
	"next_scene_id" integer,
	"is_battle_gate" boolean DEFAULT false NOT NULL,
	"battle_enemy_key" text,
	"battle_win_scene_id" integer,
	"battle_lose_scene_id" integer,
	"is_chapter_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transformations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transformations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"exp_to_next" integer DEFAULT 200 NOT NULL,
	"attack_percent" integer DEFAULT 30 NOT NULL,
	"defense_percent" integer DEFAULT 30 NOT NULL,
	"speed_percent" integer DEFAULT 30 NOT NULL,
	"hp_percent" integer DEFAULT 30 NOT NULL,
	"skill" text NOT NULL,
	"cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"duration_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_quests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_quests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"quest_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"rice" integer DEFAULT 100 NOT NULL,
	"hp" integer DEFAULT 100 NOT NULL,
	"max_hp" integer DEFAULT 100 NOT NULL,
	"attack" integer DEFAULT 10 NOT NULL,
	"defense" integer DEFAULT 10 NOT NULL,
	"speed" integer DEFAULT 10 NOT NULL,
	"str" integer DEFAULT 1 NOT NULL,
	"agi" integer DEFAULT 1 NOT NULL,
	"vit" integer DEFAULT 1 NOT NULL,
	"int" integer DEFAULT 1 NOT NULL,
	"dex" integer DEFAULT 1 NOT NULL,
	"luk" integer DEFAULT 1 NOT NULL,
	"stamina" integer DEFAULT 100 NOT NULL,
	"max_stamina" integer DEFAULT 100 NOT NULL,
	"current_location_id" integer DEFAULT 1 NOT NULL,
	"active_transform_id" integer,
	"transform_active_until" timestamp,
	"transformation_stones" integer DEFAULT 0 NOT NULL,
	"upgrade_stones" integer DEFAULT 0 NOT NULL,
	"endowment_stones" integer DEFAULT 0 NOT NULL,
	"fire_god_talisman" integer DEFAULT 0 NOT NULL,
	"flame_emperor_talisman" integer DEFAULT 0 NOT NULL,
	"pet_essence" integer DEFAULT 0 NOT NULL,
	"warrior_soul" integer DEFAULT 0 NOT NULL,
	"seppuku_count" integer DEFAULT 0 NOT NULL,
	"stat_points" integer DEFAULT 48 NOT NULL,
	"perm_attack_bonus" integer DEFAULT 0 NOT NULL,
	"perm_defense_bonus" integer DEFAULT 0 NOT NULL,
	"perm_speed_bonus" integer DEFAULT 0 NOT NULL,
	"perm_hp_bonus" integer DEFAULT 0 NOT NULL,
	"current_chapter" integer DEFAULT 0 NOT NULL,
	"has_seen_intro" boolean DEFAULT false NOT NULL,
	"title_suffix" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");