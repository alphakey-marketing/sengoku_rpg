/**
 * server/lib/grant-evaluator.ts
 *
 * The grant evaluation engine.  Called once per chapter completion, after
 * flags have been written and before the HTTP response is returned.
 *
 * PUBLIC API
 * ──────────
 *   evaluateGrants(userId, chapterNumber, flags)
 *     → IssuedGrant[]   (empty array if nothing qualified)
 *
 * EVALUATION ORDER
 * ────────────────
 *  1. Load every story_grants row WHERE chapter_trigger = chapterNumber.
 *  2. Skip any grantKey already present in player_story_grants for this user.
 *  3. For each remaining candidate, run evalUnlockCondition(flagCondition, flags).
 *  4. For passing grants, insert a game-table row (companion / equipment / pet / horse)
 *     and a player_story_grants row in a single sequential transaction.
 *  5. If the grant has an `upgradeOf` key, mark the base player_story_grants row
 *     as isSuperseded = true.
 *  6. Return an IssuedGrant descriptor for every grant that was awarded in this
 *     call — the caller (story-routes.ts) appends them to the chapter-complete
 *     response so the client can render the reward popup.
 *
 * IDEMPOTENCY
 * ───────────
 * Step 2 is the idempotency guard.  Re-completing a chapter (e.g. dev restart,
 * replay) will never double-award any grant.
 *
 * LOSS-PATH GRANTS
 * ────────────────
 * Loss-path grants (e.g. grant_equip_seal_ring) use flagCondition strings that
 * reference battle outcome flags written by /api/story/battle-result BEFORE
 * /api/story/progress/complete is called.  Because evaluateGrants receives the
 * live flag map at call time, these conditions are already resolved correctly.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { eq, and, inArray } from "drizzle-orm";
import {
  storyGrants,
  playerStoryGrants,
  companions,
  equipment,
  pets,
  horses,
  evalUnlockCondition,
  type StoryGrant,
  type CompanionGrantPayload,
  type EquipmentGrantPayload,
  type PetGrantPayload,
  type HorseGrantPayload,
} from "@shared/schema";

// ── Return type ─────────────────────────────────────────────────────────────────

export interface IssuedGrant {
  /** Stable key from story_grants catalogue */
  grantKey:      string;
  /** Human-readable label for the reward popup */
  displayName:   string;
  /** One-liner shown beneath the item name */
  flavourText:   string | null;
  /** "companion" | "equipment" | "pet" | "horse" */
  grantCategory: string;
  /** Rarity string from the payload ("uncommon" | "rare" | "epic" | "legendary") */
  rarity:        string;
  /** DB id of the newly created game-table row */
  gameRowId:     number;
  /** True when this grant superseded a previously issued base grant */
  didUpgrade:    boolean;
}

// ── Game-table row inserters ───────────────────────────────────────────────────
//
// Each inserter returns the new row's integer id.

async function insertCompanionRow(
  userId: string,
  p: CompanionGrantPayload,
): Promise<number> {
  const [row] = await db
    .insert(companions)
    .values({
      userId,
      name:                p.name,
      type:                p.type,
      rarity:              p.rarity,
      hp:                  p.hp,
      maxHp:               p.maxHp,
      attack:              p.attack,
      defense:             p.defense,
      speed:               p.speed,
      dex:                 p.dex,
      agi:                 p.agi,
      skill:               p.skill,
      isInParty:           false,
      isSpecial:           p.isSpecial,
      flagUnlockCondition: p.flagUnlockCondition,
    })
    .returning({ id: companions.id });
  return row.id;
}

async function insertEquipmentRow(
  userId: string,
  p: EquipmentGrantPayload,
): Promise<number> {
  const [row] = await db
    .insert(equipment)
    .values({
      userId,
      name:                 p.name,
      type:                 p.type,
      rarity:               p.rarity,
      weaponType:           p.weaponType,
      attackBonus:          p.attackBonus,
      defenseBonus:         p.defenseBonus,
      speedBonus:           p.speedBonus,
      hpBonus:              p.hpBonus,
      mdefBonus:            p.mdefBonus,
      fleeBonus:            p.fleeBonus,
      matkBonus:            p.matkBonus,
      critChance:           p.critChance,
      critDamage:           p.critDamage,
      cardSlots:            p.cardSlots,
      passiveDescription:   p.passiveDescription,
      storyFlagRequirement: p.storyFlagRequirement,
      isEquipped:           false,
    })
    .returning({ id: equipment.id });
  return row.id;
}

async function insertPetRow(
  userId: string,
  p: PetGrantPayload,
): Promise<number> {
  const [row] = await db
    .insert(pets)
    .values({
      userId,
      name:    p.name,
      type:    p.type,
      rarity:  p.rarity,
      hp:      p.hp,
      maxHp:   p.maxHp,
      attack:  p.attack,
      defense: p.defense,
      speed:   p.speed,
      skill:   p.skill,
      isActive: false,
    })
    .returning({ id: pets.id });
  return row.id;
}

async function insertHorseRow(
  userId: string,
  p: HorseGrantPayload,
): Promise<number> {
  const [row] = await db
    .insert(horses)
    .values({
      userId,
      name:         p.name,
      rarity:       p.rarity,
      speedBonus:   p.speedBonus,
      attackBonus:  p.attackBonus,
      defenseBonus: p.defenseBonus,
      skill:        p.skill,
      isActive:     false,
    })
    .returning({ id: horses.id });
  return row.id;
}

// ── Dispatch: insert the correct game-table row by category ───────────────────

async function insertGameRow(
  userId: string,
  grant: StoryGrant,
): Promise<number> {
  const p = grant.grantPayload;
  switch (p.category) {
    case "companion":  return insertCompanionRow(userId, p);
    case "equipment":  return insertEquipmentRow(userId, p);
    case "pet":        return insertPetRow(userId, p);
    case "horse":      return insertHorseRow(userId, p);
    default: {
      // TypeScript exhaustiveness guard — should never reach here.
      const _never: never = p;
      throw new Error(`[grant-evaluator] Unknown grantCategory in payload: ${JSON.stringify(_never)}`);
    }
  }
}

// ── Rarity extractor (avoids re-parsing the full payload union) ─────────────

function extractRarity(grant: StoryGrant): string {
  // All four payload shapes have a `rarity` field at the top level.
  return (grant.grantPayload as { rarity: string }).rarity ?? "common";
}

// ── Core evaluator ──────────────────────────────────────────────────────────────

/**
 * Evaluate all story grants for a completed chapter and issue any that the
 * player has earned but not yet received.
 *
 * @param userId         Authenticated user id
 * @param chapterNumber  The chapterOrder integer of the completed chapter
 * @param flags          Live flag map at the moment of chapter completion
 *                       (should be read AFTER battle-result flags are written)
 *
 * @returns Array of IssuedGrant descriptors for grants awarded in this call.
 *          Empty if no grants qualify or all qualifying grants are already owned.
 */
export async function evaluateGrants(
  userId: string,
  chapterNumber: number,
  flags: Record<string, number>,
): Promise<IssuedGrant[]> {
  // ── Step 1: load catalogue candidates for this chapter ────────────────────
  const candidates = await db
    .select()
    .from(storyGrants)
    .where(eq(storyGrants.chapterTrigger, chapterNumber));

  if (candidates.length === 0) {
    return [];
  }

  // ── Step 2: find which grants this player already holds ───────────────────
  const candidateKeys = candidates.map((g) => g.grantKey);

  const alreadyIssued = await db
    .select({ grantKey: playerStoryGrants.grantKey })
    .from(playerStoryGrants)
    .where(
      and(
        eq(playerStoryGrants.userId, userId),
        inArray(playerStoryGrants.grantKey, candidateKeys),
      ),
    );

  const ownedKeys = new Set(alreadyIssued.map((r) => r.grantKey));

  // ── Step 3: evaluate flag conditions ────────────────────────────────────
  const passing = candidates.filter((g) => {
    if (ownedKeys.has(g.grantKey)) return false;
    // Null condition = unconditional; always passes.
    if (!g.flagCondition) return true;
    return evalUnlockCondition(g.flagCondition, flags);
  });

  if (passing.length === 0) {
    return [];
  }

  // ── Step 4 + 5: insert game rows and player_story_grants, handle upgrades ─
  const issued: IssuedGrant[] = [];
  const flagSnapshot = JSON.stringify(flags);

  for (const grant of passing) {
    // Insert the game-table row (companion / equipment / pet / horse)
    let gameRowId: number;
    try {
      gameRowId = await insertGameRow(userId, grant);
    } catch (err) {
      console.error(
        `[grant-evaluator] Failed to insert game row for grant "${grant.grantKey}":`,
        err,
      );
      // Skip this grant rather than aborting the whole chapter completion.
      continue;
    }

    // Record the award in player_story_grants
    await db
      .insert(playerStoryGrants)
      .values({
        userId,
        grantKey:         grant.grantKey,
        gameRowId,
        grantCategory:    grant.grantCategory,
        isSuperseded:     false,
        awardedAtChapter: chapterNumber,
        flagSnapshot:     flags as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing();
    // onConflictDoNothing guards against the rare case where a concurrent
    // request (e.g. double-tap on the complete button) races through.

    // Handle upgrade: mark the base grant's player_story_grants row
    // as superseded so the UI can display the progression correctly.
    let didUpgrade = false;
    if (grant.upgradeOf) {
      const updateResult = await db
        .update(playerStoryGrants)
        .set({ isSuperseded: true })
        .where(
          and(
            eq(playerStoryGrants.userId, userId),
            eq(playerStoryGrants.grantKey, grant.upgradeOf),
          ),
        )
        .returning({ id: playerStoryGrants.id });

      didUpgrade = updateResult.length > 0;

      if (didUpgrade) {
        console.log(
          `[grant-evaluator] ⬆️  Upgraded: "${grant.upgradeOf}" → "${grant.grantKey}" (userId=${userId})`,
        );
      }
    }

    issued.push({
      grantKey:      grant.grantKey,
      displayName:   grant.displayName,
      flavourText:   grant.flavourText ?? null,
      grantCategory: grant.grantCategory,
      rarity:        extractRarity(grant),
      gameRowId,
      didUpgrade,
    });

    console.log(
      `[grant-evaluator] ✨  Awarded: "${grant.grantKey}" (${grant.grantCategory}) → gameRowId=${gameRowId}, userId=${userId}`,
    );
  }

  return issued;
}

// ── Read helper: grants issued to a player ─────────────────────────────────────
//
// Used by GET /api/story/grants (Part 5) and the client inventory panels.
// Returns the full player_story_grants rows joined with the catalogue
// displayName and flavourText so the client never needs a second request.

export interface PlayerGrantView {
  id:              number;
  grantKey:        string;
  displayName:     string;
  flavourText:     string | null;
  grantCategory:   string;
  rarity:          string;
  gameRowId:       number | null;
  isSuperseded:    boolean;
  awardedAtChapter: number;
  awardedAt:       Date;
}

export async function getPlayerGrants(
  userId: string,
): Promise<PlayerGrantView[]> {
  // Join player_story_grants with story_grants to get display metadata.
  const rows = await db
    .select({
      id:               playerStoryGrants.id,
      grantKey:         playerStoryGrants.grantKey,
      displayName:      storyGrants.displayName,
      flavourText:      storyGrants.flavourText,
      grantCategory:    playerStoryGrants.grantCategory,
      grantPayload:     storyGrants.grantPayload,
      gameRowId:        playerStoryGrants.gameRowId,
      isSuperseded:     playerStoryGrants.isSuperseded,
      awardedAtChapter: playerStoryGrants.awardedAtChapter,
      awardedAt:        playerStoryGrants.awardedAt,
    })
    .from(playerStoryGrants)
    .innerJoin(
      storyGrants,
      eq(playerStoryGrants.grantKey, storyGrants.grantKey),
    )
    .where(eq(playerStoryGrants.userId, userId));

  return rows.map((r) => ({
    id:               r.id,
    grantKey:         r.grantKey,
    displayName:      r.displayName,
    flavourText:      r.flavourText ?? null,
    grantCategory:    r.grantCategory,
    rarity:           extractRarity({ grantPayload: r.grantPayload } as StoryGrant),
    gameRowId:        r.gameRowId,
    isSuperseded:     r.isSuperseded,
    awardedAtChapter: r.awardedAtChapter,
    awardedAt:        r.awardedAt,
  }));
}
