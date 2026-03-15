import { db } from "../db";
import { playerTitles, playerEarnedTitles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getPlayerFlagMap } from "./flag-map";
import { evalUnlockCondition } from "@shared/schema";

// ── Static title catalogue ────────────────────────────────────────────────────
//
// titleKey must match what is seeded into the player_titles table.
// earnCondition uses the same grammar as A2/A3 flag gates.
// Titles with earnCondition = null are granted exclusively via grantTitle().

export const TITLE_CATALOGUE: Array<{
  titleKey: string;
  displayName: string;
  description: string;
  earnCondition: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
}> = [
  // ── Common ─────────────────────────────────────────────────────────────
  {
    titleKey:      "first_blood",
    displayName:   "First Blood",
    description:   "Won your first battle.",
    earnCondition: "total_battles_won>=1",
    rarity:        "common",
  },
  {
    titleKey:      "wanderer",
    displayName:   "Wanderer",
    description:   "Explored your first province.",
    earnCondition: "provinces_held>=1",
    rarity:        "common",
  },
  // ── Rare ───────────────────────────────────────────────────────────────
  {
    titleKey:      "loyal_heart",
    displayName:   "Loyal Heart",
    description:   "Earned the loyalty of a legendary companion.",
    earnCondition: "loyalty_achieved>=1",
    rarity:        "rare",
  },
  {
    titleKey:      "ronin",
    displayName:   "Rōnin",
    description:   "Fought ten battles alone, without companions.",
    earnCondition: "solo_battles>=10",
    rarity:        "rare",
  },
  {
    titleKey:      "shadow_blade",
    displayName:   "Shadow Blade",
    description:   "Defeated a ninja in single combat.",
    earnCondition: "ninja_kills>=1",
    rarity:        "rare",
  },
  // ── Epic ───────────────────────────────────────────────────────────────
  {
    titleKey:      "iron_general",
    displayName:   "Iron General",
    description:   "Conquered five provinces.",
    earnCondition: "provinces_held>=5",
    rarity:        "epic",
  },
  {
    titleKey:      "ruthless_one",
    displayName:   "The Ruthless One",
    description:   "Chose the path of iron over mercy.",
    earnCondition: "ruthlessness>=5",
    rarity:        "epic",
  },
  {
    titleKey:      "merciful_lord",
    displayName:   "Merciful Lord",
    description:   "Spared the fallen three times.",
    earnCondition: "mercy_shown>=3",
    rarity:        "epic",
  },
  {
    titleKey:      "shadow_tactician",
    displayName:   "Shadow Tactician",
    description:   "Completed a chapter without losing a companion.",
    earnCondition: "chapter_no_companion_loss>=1",
    rarity:        "epic",
  },
  // ── Legendary ──────────────────────────────────────────────────────────
  {
    titleKey:      "demon_king",
    displayName:   "Demon King",
    description:   "Walked Nobunaga's path to its darkest end.",
    earnCondition: null,   // granted via grantTitle() at story ending
    rarity:        "legendary",
  },
  {
    titleKey:      "unifier",
    displayName:   "The Unifier",
    description:   "United the realm without shedding unnecessary blood.",
    earnCondition: null,
    rarity:        "legendary",
  },
  {
    titleKey:      "ghost_of_honnoji",
    displayName:   "Ghost of Honnō-ji",
    description:   "Survived the betrayal and returned.",
    earnCondition: "honnoji_survived==1",
    rarity:        "legendary",
  },
];

// ── Sync catalogue to DB ──────────────────────────────────────────────────────
//
// Called once at server startup (from server/index.ts).
// Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to run repeatedly.
export async function syncTitleCatalogue(): Promise<void> {
  for (const t of TITLE_CATALOGUE) {
    await db
      .insert(playerTitles)
      .values({
        titleKey:      t.titleKey,
        displayName:   t.displayName,
        description:   t.description,
        earnCondition: t.earnCondition,
        rarity:        t.rarity,
      })
      .onConflictDoNothing()
      .catch(() => { /* ignore */ });
  }
}

// ── Evaluate & auto-award titles ──────────────────────────────────────────────
//
// Checks every title with an earnCondition against the player's live flags.
// Any that are newly satisfied are inserted into player_earned_titles.
// Returns the list of newly earned titles (empty array if nothing changed).
export async function evaluateTitles(
  userId: string,
): Promise<Array<{ titleKey: string; displayName: string; rarity: string }>> {
  const flagMap = await getPlayerFlagMap(userId);

  // Titles this player already owns
  const alreadyEarned = await db
    .select()
    .from(playerEarnedTitles)
    .where(eq(playerEarnedTitles.userId, userId));
  const ownedIds = new Set(alreadyEarned.map(e => e.titleId));

  // All catalogue rows from DB
  const catalogue = await db.select().from(playerTitles);

  const newlyEarned: Array<{ titleKey: string; displayName: string; rarity: string }> = [];

  for (const title of catalogue) {
    if (ownedIds.has(title.id)) continue;
    if (!title.earnCondition)  continue;
    if (!evalUnlockCondition(title.earnCondition, flagMap)) continue;

    await db
      .insert(playerEarnedTitles)
      .values({ userId, titleId: title.id, earnedAt: new Date() })
      .onConflictDoNothing()
      .catch(() => { /* ignore */ });

    newlyEarned.push({
      titleKey:    title.titleKey,
      displayName: title.displayName,
      rarity:      title.rarity,
    });
  }

  return newlyEarned;
}

// ── Direct grant ─────────────────────────────────────────────────────────────
//
// For story-ending rewards and special events.
// Safe to call multiple times — silently skips if already owned.
export async function grantTitle(
  userId: string,
  titleKey: string,
): Promise<{ granted: boolean; title?: any }> {
  const [title] = await db
    .select()
    .from(playerTitles)
    .where(eq(playerTitles.titleKey, titleKey));
  if (!title) return { granted: false };

  const [existing] = await db
    .select()
    .from(playerEarnedTitles)
    .where(
      and(
        eq(playerEarnedTitles.userId, userId),
        eq(playerEarnedTitles.titleId, title.id),
      ),
    );
  if (existing) return { granted: false, title };

  await db
    .insert(playerEarnedTitles)
    .values({ userId, titleId: title.id, earnedAt: new Date() });

  return { granted: true, title };
}
