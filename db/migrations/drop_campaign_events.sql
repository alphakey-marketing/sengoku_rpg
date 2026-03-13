-- Phase C2: Drop the legacy campaign_events table.
--
-- This table was used by the old campaign system (campaign.tsx / campaign.ts)
-- which was removed in Phase C1. All TypeScript references (table object,
-- Drizzle relations, insert schema, CampaignEvent type, storage methods) were
-- stripped in C1 + C2. This migration finalises the cleanup at the DB level.
--
-- Run manually against the target database when ready to drop live data:
--   psql $DATABASE_URL -f db/migrations/drop_campaign_events.sql
--
-- Safe to run multiple times (IF EXISTS guard).

DROP TABLE IF EXISTS campaign_events;
