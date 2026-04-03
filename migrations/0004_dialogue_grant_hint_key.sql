-- Sprint 4 (1a) — Dialogue Grant Hint Shimmer
-- Adds grant_hint_key (nullable TEXT) to dialogue_lines.
--
-- When set by scene writers (via "grantHintKey" in the chapter JSON),
-- StoryPlayer renders a 2px amber shimmer underline on the speaker name
-- label — a subtle visual cue that this dialogue line carries a grant
-- consequence.  NULL rows are completely unaffected (no UI change).
--
-- Drizzle migration: generated for tracking purposes.
-- The authoritative idempotent runner is server/migrate.ts.

ALTER TABLE dialogue_lines
  ADD COLUMN IF NOT EXISTS grant_hint_key TEXT;
