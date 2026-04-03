-- Migration 0003: sync users column defaults with schema.ts FIX 1 values
-- and backfill existing rows that are still at the old defaults.

-- ── 1. Fix column defaults (new users) ──────────────────────────────────────

ALTER TABLE "users"
  ALTER COLUMN "str"     SET DEFAULT 10,
  ALTER COLUMN "agi"     SET DEFAULT 10,
  ALTER COLUMN "vit"     SET DEFAULT 10,
  ALTER COLUMN "int"     SET DEFAULT 10,
  ALTER COLUMN "dex"     SET DEFAULT 10,
  ALTER COLUMN "luk"     SET DEFAULT 10,
  ALTER COLUMN "gold"    SET DEFAULT 500,
  ALTER COLUMN "hp"      SET DEFAULT 200,
  ALTER COLUMN "max_hp"  SET DEFAULT 200,
  ALTER COLUMN "attack"  SET DEFAULT 30,
  ALTER COLUMN "defense" SET DEFAULT 20;

-- ── 2. Backfill existing rows still sitting at the stale defaults ────────────
-- Only touches rows where the column is still at the exact original default,
-- so players who spent gold or received custom stat changes are unaffected.

UPDATE "users"
SET
  "str"     = CASE WHEN "str"     = 1   THEN 10  ELSE "str"     END,
  "agi"     = CASE WHEN "agi"     = 1   THEN 10  ELSE "agi"     END,
  "vit"     = CASE WHEN "vit"     = 1   THEN 10  ELSE "vit"     END,
  "int"     = CASE WHEN "int"     = 1   THEN 10  ELSE "int"     END,
  "dex"     = CASE WHEN "dex"     = 1   THEN 10  ELSE "dex"     END,
  "luk"     = CASE WHEN "luk"     = 1   THEN 10  ELSE "luk"     END,
  "gold"    = CASE WHEN "gold"    = 0   THEN 500 ELSE "gold"    END,
  "hp"      = CASE WHEN "hp"      = 100 THEN 200 ELSE "hp"      END,
  "max_hp"  = CASE WHEN "max_hp"  = 100 THEN 200 ELSE "max_hp"  END,
  "attack"  = CASE WHEN "attack"  = 10  THEN 30  ELSE "attack"  END,
  "defense" = CASE WHEN "defense" = 10  THEN 20  ELSE "defense" END
WHERE
  "str"     = 1   OR
  "agi"     = 1   OR
  "vit"     = 1   OR
  "int"     = 1   OR
  "dex"     = 1   OR
  "luk"     = 1   OR
  "gold"    = 0   OR
  "hp"      = 100 OR
  "max_hp"  = 100 OR
  "attack"  = 10  OR
  "defense" = 10;
