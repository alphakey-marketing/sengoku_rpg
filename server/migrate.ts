/**
 * server/migrate.ts
 *
 * Idempotent startup migration runner.
 *
 * Instead of Drizzle migration files (which require a separate CLI step that
 * doesn't work cleanly on Replit), we run raw DDL statements using
 * ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
 *
 * Rules:
 *   1. Every statement must be safe to run on an already-up-to-date DB.
 *   2. Add new statements at the BOTTOM of the list — never edit old ones.
 *   3. Statements run in order inside a single transaction; if any fail
 *      the whole batch rolls back and the server exits with a clear error.
 */
import { pool } from "./db";

const MIGRATIONS: string[] = [
  // ── users table: base stat columns (safe re-runs) ──────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS str               INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS agi               INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS vit               INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "int"             INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS dex               INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS luk               INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS stat_points       INTEGER NOT NULL DEFAULT 48`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS warrior_soul      INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS seppuku_count     INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_attack_bonus  INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_defense_bonus INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_speed_bonus   INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS perm_hp_bonus      INTEGER NOT NULL DEFAULT 0`,

  // ── users table: onboarding columns (Phase 4 / C-series) ──────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS current_chapter   INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_intro    BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS title_suffix      VARCHAR(64)`,

  // ── users table: C2 active title FK ───────────────────────────────────────
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS active_title_id   INTEGER`,

  // ── C1: Chronicle Wall ────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS chronicle_entries (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        VARCHAR NOT NULL,
    entry_key      TEXT    NOT NULL,
    headline       TEXT    NOT NULL,
    detail         TEXT,
    flag_snapshot  JSONB   NOT NULL DEFAULT '{}'::jsonb,
    chapter_number INTEGER NOT NULL DEFAULT 0,
    recorded_at    TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // ── C2: Player Titles catalogue ───────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS player_titles (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title_key    TEXT    NOT NULL UNIQUE,
    display_name TEXT    NOT NULL,
    description  TEXT,
    earn_condition TEXT,
    rarity       TEXT    NOT NULL DEFAULT 'common',
    created_at   TIMESTAMP DEFAULT NOW()
  )`,

  // ── C2: Player Earned Titles join table ───────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS player_earned_titles (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    VARCHAR   NOT NULL,
    title_id   INTEGER   NOT NULL,
    earned_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // ── B3: Held Provinces ────────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS held_provinces (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      VARCHAR   NOT NULL,
    location_id  INTEGER   NOT NULL,
    boss_defeated BOOLEAN  NOT NULL DEFAULT FALSE,
    held_at      TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // ── equipment: extra bonus columns added in later schema revisions ─────────
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS hp_bonus         INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS mdef_bonus       INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS flee_bonus       INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS matk_bonus       INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rarity           TEXT    NOT NULL DEFAULT 'white'`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS card_slots       INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS story_flag_requirement TEXT`,

  // ── companions: columns added in A2/A3 ────────────────────────────────────
  `ALTER TABLE companions ADD COLUMN IF NOT EXISTS dex               INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE companions ADD COLUMN IF NOT EXISTS agi               INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE companions ADD COLUMN IF NOT EXISTS is_special        BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE companions ADD COLUMN IF NOT EXISTS flag_unlock_condition TEXT`,

  // ── M1 FIX: Backfill str/agi/vit/int/dex/luk from 1 → 10 (legacy rows) ───
  //
  // The original ADD COLUMN statements above used DEFAULT 1, which was lower
  // than the schema.ts / STARTING_STATS default of 10.  Any account created
  // before this fix has base stats of 1, producing near-zero combat values.
  //
  // These UPDATE statements are idempotent: they only touch rows that are
  // still at the stale default (= 1), so players who have already allocated
  // stat points above 1 are left completely untouched.
  `UPDATE users SET str   = 10 WHERE str   = 1`,
  `UPDATE users SET agi   = 10 WHERE agi   = 1`,
  `UPDATE users SET vit   = 10 WHERE vit   = 1`,
  `UPDATE users SET "int" = 10 WHERE "int" = 1`,
  `UPDATE users SET dex   = 10 WHERE dex   = 1`,
  `UPDATE users SET luk   = 10 WHERE luk   = 1`,

  // ── M11 FIX: Backfill FIX-1 raised resource defaults (legacy rows) ────────
  //
  // schema.ts raised starting values (the "FIX 1" block) for hp / maxHp /
  // attack / defense / gold.  The ADD COLUMN statements above never backfilled
  // existing rows.  We apply the new floor ONLY to level-1 players whose
  // values are still at the original stale defaults, so active high-level
  // players (who genuinely earned lower stats via old code) are not touched.
  //
  //   Stale defaults  : hp=100, max_hp=100, attack=10, defense=5,  gold=100
  //   Schema defaults : hp=200, max_hp=200, attack=30, defense=20, gold=500
  `UPDATE users SET hp      = 200 WHERE hp      < 200 AND level = 1`,
  `UPDATE users SET max_hp  = 200 WHERE max_hp  < 200 AND level = 1`,
  `UPDATE users SET attack  = 30  WHERE attack  < 30  AND level = 1`,
  `UPDATE users SET defense = 20  WHERE defense < 20  AND level = 1`,
  `UPDATE users SET gold    = 500 WHERE gold    < 500 AND level = 1`,

  // ── STORY ENGINE: story_scenes columns missing from live DB ───────────────
  //
  // The story_scenes table is created by Drizzle's createTable (via schema.ts)
  // but columns added to the Drizzle schema after the initial table creation
  // were never reflected here, causing:
  //
  //   column "conditional_variants" does not exist  (pg error 42703)
  //   → GET /api/story/chapters/:id → 500
  //   → "Failed to load chapter. Please refresh." in the UI
  //
  // All statements use ADD COLUMN IF NOT EXISTS so they are safe to re-run
  // on any DB that already has some or all of these columns.
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS bgm_key               TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS battle_win_scene_id   INTEGER`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS battle_lose_scene_id  INTEGER`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS conditional_variants  JSONB`,

  // ── STORY ENGINE: story_chapters column missing from live DB ─────────────
  //
  // first_scene_id is written by seed-story-chapters.ts after inserting scenes
  // but the column may not exist on DBs created before this schema addition.
  `ALTER TABLE story_chapters ADD COLUMN IF NOT EXISTS first_scene_id      INTEGER`,
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[migrate] Running startup migrations…");
    await client.query("BEGIN");
    for (const sql of MIGRATIONS) {
      await client.query(sql);
    }
    await client.query("COMMIT");
    console.log(`[migrate] Done — ${MIGRATIONS.length} statements applied.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] FAILED — rolled back:", err);
    // Re-throw so the server refuses to start with a broken schema.
    throw err;
  } finally {
    client.release();
  }
}
