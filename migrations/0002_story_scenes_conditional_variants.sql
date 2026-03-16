-- Migration 0002: add conditional_variants JSONB column to story_scenes
-- Nullable so all existing rows are unaffected; defaults to NULL.

ALTER TABLE "story_scenes"
  ADD COLUMN IF NOT EXISTS "conditional_variants" jsonb DEFAULT NULL;
