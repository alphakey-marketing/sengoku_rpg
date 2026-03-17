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
  `UPDATE users SET str   = 10 WHERE str   = 1`,
  `UPDATE users SET agi   = 10 WHERE agi   = 1`,
  `UPDATE users SET vit   = 10 WHERE vit   = 1`,
  `UPDATE users SET "int" = 10 WHERE "int" = 1`,
  `UPDATE users SET dex   = 10 WHERE dex   = 1`,
  `UPDATE users SET luk   = 10 WHERE luk   = 1`,

  // ── M11 FIX: Backfill FIX-1 raised resource defaults (legacy rows) ────────
  `UPDATE users SET hp      = 200 WHERE hp      < 200 AND level = 1`,
  `UPDATE users SET max_hp  = 200 WHERE max_hp  < 200 AND level = 1`,
  `UPDATE users SET attack  = 30  WHERE attack  < 30  AND level = 1`,
  `UPDATE users SET defense = 20  WHERE defense < 20  AND level = 1`,
  `UPDATE users SET gold    = 500 WHERE gold    < 500 AND level = 1`,

  // ── STORY ENGINE: story_scenes columns missing from live DB ───────────────
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS bgm_key               TEXT    NOT NULL DEFAULT ''`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS battle_win_scene_id   INTEGER`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS battle_lose_scene_id  INTEGER`,
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS conditional_variants  JSONB`,

  // ── STORY ENGINE: story_chapters column missing from live DB ─────────────
  `ALTER TABLE story_chapters ADD COLUMN IF NOT EXISTS first_scene_id      INTEGER`,

  // ── STORY GRANT SYSTEM (Part 4/10) ───────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS story_grants (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grant_key       TEXT      NOT NULL UNIQUE,
    display_name    TEXT      NOT NULL,
    flavour_text    TEXT,
    chapter_trigger INTEGER   NOT NULL,
    flag_condition  TEXT,
    grant_category  TEXT      NOT NULL,
    grant_payload   JSONB     NOT NULL,
    upgrade_of      TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS story_grants_chapter_trigger_idx
     ON story_grants (chapter_trigger)`,

  `CREATE INDEX IF NOT EXISTS story_grants_grant_key_idx
     ON story_grants (grant_key)`,

  `
  CREATE TABLE IF NOT EXISTS player_story_grants (
    id                INTEGER   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           VARCHAR   NOT NULL,
    grant_key         TEXT      NOT NULL,
    game_row_id       INTEGER,
    grant_category    TEXT      NOT NULL,
    is_superseded     BOOLEAN   NOT NULL DEFAULT FALSE,
    awarded_at_chapter INTEGER  NOT NULL,
    flag_snapshot     JSONB     NOT NULL DEFAULT '{}'::jsonb,
    awarded_at        TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS player_story_grants_user_id_idx
     ON player_story_grants (user_id)`,

  `CREATE INDEX IF NOT EXISTS player_story_grants_user_grant_idx
     ON player_story_grants (user_id, grant_key)`,

  // ── STORY GRANT SYSTEM: equipment.passive_description column ─────────────
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS passive_description TEXT`,

  // ── UAT-FIX-STATS: correct column DEFAULT for str/agi/vit/int/dex/luk ────
  `ALTER TABLE users ALTER COLUMN str   SET DEFAULT 10`,
  `ALTER TABLE users ALTER COLUMN agi   SET DEFAULT 10`,
  `ALTER TABLE users ALTER COLUMN vit   SET DEFAULT 10`,
  `ALTER TABLE users ALTER COLUMN "int" SET DEFAULT 10`,
  `ALTER TABLE users ALTER COLUMN dex   SET DEFAULT 10`,
  `ALTER TABLE users ALTER COLUMN luk   SET DEFAULT 10`,

  // ── UAT-FIX-STATS: safe second-pass backfill now that DEFAULT is fixed ────
  `UPDATE users SET str   = 10 WHERE str   = 1`,
  `UPDATE users SET agi   = 10 WHERE agi   = 1`,
  `UPDATE users SET vit   = 10 WHERE vit   = 1`,
  `UPDATE users SET "int" = 10 WHERE "int" = 1`,
  `UPDATE users SET dex   = 10 WHERE dex   = 1`,
  `UPDATE users SET luk   = 10 WHERE luk   = 1`,

  // ── Phase 1 part 2: scene-level flagWrites engine ─────────────────────────
  `ALTER TABLE story_scenes ADD COLUMN IF NOT EXISTS flag_writes JSONB`,

  // ── Sprint 4 (1a): Dialogue Grant Hint Shimmer ────────────────────────────
  //
  // Adds grant_hint_key (nullable TEXT) to dialogue_lines.
  //
  // When a scene writer sets "grantHintKey": "ch2_nohime_sword" on a dialogue
  // line in the chapter JSON, StoryPlayer renders a 2 px amber shimmer
  // underline beneath the speaker name for that line — a subtle visual cue
  // that this line carries a grant consequence.  No item is revealed; the
  // underline disappears as the line advances.
  //
  // NULL (the default for all pre-existing rows) → no UI change.
  // TEXT → speaker label gets `animate-shimmer` underline class.
  //
  // Cross-references:
  //   shared/schema.ts                → dialogueLines.grantHintKey column
  //   migrations/0004_*.sql           → same DDL for Drizzle tracking
  //   server/seed-story-chapters.ts   → JsonDialogueLine.grantHintKey
  //   client/src/lib/story-engine.ts  → DialogueLine.grantHintKey
  //   client/src/components/story/StoryPlayer.tsx → shimmer render
  `ALTER TABLE dialogue_lines ADD COLUMN IF NOT EXISTS grant_hint_key TEXT`,

  // ── BUG 2 FIX: Backfill nohime_witnessed_win flagWrite onto Ch3 S07B_WIN ──
  //
  // chapter_03.json already declares flagWrites on S07B_WIN (scene_order=16):
  //   { "flagKey": "nohime_witnessed_win", "flagValue": 1 }
  //
  // However the chapter seeder is idempotent: it skips any chapter whose title
  // is already present in story_chapters. All deployed instances have Ch3
  // seeded without this flagWrite, so grant_weapon_captains_jitte
  // (flagCondition: "nohime_witnessed_win==1") could never fire.
  //
  // This UPDATE merges the missing entry into story_scenes.flag_writes JSONB
  // for the S07B_WIN scene row (chapter_order=3, scene_order=16).
  //
  // Idempotency: jsonb_set replaces the key whether or not it exists, so
  // running this on an already-patched DB is safe — the value stays the same.
  //
  // The join path is:
  //   story_chapters.chapter_order = 3           → identifies Ch3
  //   story_scenes.chapter_id = story_chapters.id
  //   story_scenes.scene_order = 16              → S07B_WIN (battle-win result)
  `
  UPDATE story_scenes ss
  SET    flag_writes = jsonb_set(
           COALESCE(ss.flag_writes, '[]'::jsonb),
           '{0}',
           '[{"flagKey":"nohime_witnessed_win","flagValue":1}]'::jsonb -> 0,
           true
         )
  FROM   story_chapters sc
  WHERE  sc.chapter_order = 3
    AND  ss.chapter_id    = sc.id
    AND  ss.scene_order   = 16
    AND  NOT EXISTS (
           SELECT 1
           FROM   jsonb_array_elements(COALESCE(ss.flag_writes, '[]'::jsonb)) elem
           WHERE  elem->>'flagKey' = 'nohime_witnessed_win'
         )`,

  // ── BUG 1 FIX: Backfill correct flag_condition for grant_weapon_reforged_blade ──
  //
  // seed-story-grants.ts is idempotent by grantKey (INSERT … skip if exists).
  // Any DB seeded before the Bug 1 fix still holds the original condition:
  //   flag_condition = 'weapon_legacy>=1'   (too broad)
  // which matched BOTH the Ch1 singing-blade path AND the Ch2 anonymous-sword
  // path, causing duplicate weapon slots and a dangling upgradeOf pointer for
  // anonymous-sword players.
  //
  // Corrected value:
  //   flag_condition = 'supernatural_affinity>=2'  (singing-blade path only)
  //
  // Idempotency: the WHERE clause matches only when the old value is still
  // present.  Running on an already-patched DB is a no-op (0 rows updated).
  `UPDATE story_grants
   SET   flag_condition = 'supernatural_affinity>=2'
   WHERE grant_key      = 'grant_weapon_reforged_blade'
     AND flag_condition = 'weapon_legacy>=1'`,

  // ── BUG 1 FIX (cont.): Backfill upgrade_of for grant_weapon_reforged_blade_v2 ──
  //
  // This parallel Ch5 row (anonymous-sword lineage) was added in the same
  // fix commit as grant_weapon_reforged_blade.  Any DB seeded before the fix
  // either does not have this row at all (seeder will INSERT it on next
  // startup) or has it with upgrade_of = NULL (race: row seeded between
  // deploy and restart).  Ensure the pointer is set.
  //
  // Idempotency: WHERE upgrade_of IS NULL prevents re-running.
  `UPDATE story_grants
   SET   upgrade_of = 'grant_weapon_anonymous_sword'
   WHERE grant_key  = 'grant_weapon_reforged_blade_v2'
     AND upgrade_of IS NULL`,

  // ── BUG 3 FIX: Backfill correct flag_condition for grant_horse_nobuyasu_road ──
  //
  // Any DB seeded before the Bug 3 fix holds:
  //   flag_condition = 'road_command>=1'
  // which also matched Ch1 Okehazama winners (road_command written by S09_WIN),
  // causing them to receive a second uncommon horse (grant_horse_nobuyasu_road)
  // on Ch2 completion in addition to grant_horse_ch1_victory.
  //
  // Corrected value:
  //   flag_condition = 'road_command>=2'  (requires Ch1 + Ch2 road_command writes)
  //
  // Idempotency: WHERE matches old value only.
  `UPDATE story_grants
   SET   flag_condition = 'road_command>=2'
   WHERE grant_key      = 'grant_horse_nobuyasu_road'
     AND flag_condition = 'road_command>=1'`,
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[migrate] Running startup migrations\u2026");
    await client.query("BEGIN");
    for (const sql of MIGRATIONS) {
      await client.query(sql);
    }
    await client.query("COMMIT");
    console.log(`[migrate] Done \u2014 ${MIGRATIONS.length} statements applied.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] FAILED \u2014 rolled back:", err);
    throw err;
  } finally {
    client.release();
  }
}
