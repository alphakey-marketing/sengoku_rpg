/**
 * Story Tables Migration Script
 * Usage: npm run migrate:story
 *
 * Creates the 7 VN story engine tables directly via SQL.
 * Uses IF NOT EXISTS — fully safe to re-run.
 * Bypasses Drizzle db:push sequence conflict bug.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sql = `
  CREATE TABLE IF NOT EXISTS story_chapters (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    chapter_order INTEGER NOT NULL,
    first_scene_id INTEGER,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS story_scenes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chapter_id INTEGER NOT NULL,
    background_key TEXT NOT NULL DEFAULT 'default',
    bgm_key TEXT NOT NULL DEFAULT 'default',
    scene_order INTEGER NOT NULL,
    next_scene_id INTEGER,
    is_battle_gate BOOLEAN NOT NULL DEFAULT false,
    battle_enemy_key TEXT,
    battle_win_scene_id INTEGER,
    battle_lose_scene_id INTEGER,
    is_chapter_end BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS dialogue_lines (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scene_id INTEGER NOT NULL,
    speaker_name TEXT NOT NULL,
    speaker_side TEXT NOT NULL DEFAULT 'none',
    text TEXT NOT NULL,
    portrait_key TEXT,
    line_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS story_choices (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scene_id INTEGER NOT NULL,
    choice_text TEXT NOT NULL,
    next_scene_id INTEGER NOT NULL,
    flag_key TEXT,
    flag_value INTEGER,
    flag_key2 TEXT,
    flag_value2 INTEGER,
    choice_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS player_flags (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    flag_key TEXT NOT NULL,
    flag_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS player_progress (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    chapter_id INTEGER NOT NULL,
    current_scene_id INTEGER,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    seen_scene_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS unlocked_endings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    ending_key TEXT NOT NULL,
    ending_title TEXT NOT NULL,
    ending_description TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT NOW()
  );
`;

async function main() {
  const client = await pool.connect();
  try {
    console.log("Creating story tables...");
    await client.query(sql);
    console.log("✅ All story tables created (or already existed).");

    // Confirm what exists
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'story_chapters', 'story_scenes', 'dialogue_lines',
        'story_choices', 'player_flags', 'player_progress', 'unlocked_endings'
      )
      ORDER BY table_name;
    `);
    console.log("\nConfirmed tables in database:");
    result.rows.forEach((r) => console.log(`  ✓ ${r.table_name}`));
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
