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
