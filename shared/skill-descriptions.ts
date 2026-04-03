/**
 * shared/skill-descriptions.ts
 *
 * Maps every skill key used in the story_grants catalogue to a human-readable
 * name and description string pair.  Consumed by:
 *
 *   • server/combat.ts          (Part 8)  — resolves effect logic by key
 *   • client reward popup       (Part 9)  — displays skill name + description
 *   • client inventory panels   (Part 10) — tooltip on companion/horse/pet cards
 *
 * SKILL KEY NAMING CONVENTION
 * ───────────────────────────
 * snake_case.  One key per skill.  Keys must be stable — the combat engine
 * (Part 8) branches on them at runtime.  Never rename a key without updating
 * combat.ts simultaneously.
 *
 * ADDING NEW SKILLS
 * ─────────────────
 *  1. Add an entry to SKILL_DESCRIPTIONS below.
 *  2. Add the combat effect to server/combat.ts (Part 8).
 *  3. Add the key to the appropriate payload in seed-story-grants.ts.
 */

export interface SkillDescription {
  /** Short name shown in item cards and the reward popup header */
  name: string;
  /** One- or two-sentence description shown in tooltips and the Chronicle Wall */
  description: string;
  /**
   * Combat effect category — used by combat.ts to branch into the right handler.
   *
   * "passive_stat"      — always-on numeric modifier (speed / attack / defense)
   * "passive_aura"      — always-on effect that benefits the party or penalises the enemy
   * "on_enter"          — fires once at the start of combat
   * "on_hit"            — fires on each successful attack
   * "on_low_hp"         — fires when the bearer drops below 30% HP
   * "on_kill"           — fires when the bearer lands the killing blow
   * "counter"           — fires when the bearer receives a hit
   * "debuff_aura"       — applies a persistent debuff to the enemy
   * "survival"          — modifies death / flee logic
   * "narrative"         — no combat effect; Chronicle Wall / flavour only
   */
  effectCategory: SkillEffectCategory;
}

export type SkillEffectCategory =
  | "passive_stat"
  | "passive_aura"
  | "on_enter"
  | "on_hit"
  | "on_low_hp"
  | "on_kill"
  | "counter"
  | "debuff_aura"
  | "survival"
  | "narrative";

// ─────────────────────────────────────────────────────────────────────────────
const SKILL_DESCRIPTIONS: Record<string, SkillDescription> = {

  // ═════════════════════════════════════════════════════════════════════
  // Horse skills
  // ═════════════════════════════════════════════════════════════════════

  border_road: {
    name:           "Border Road",
    description:    "Bred on the contested Mino border tracks. Grants +10% flee speed and reduces ambush chance by 15%.",
    effectCategory: "passive_stat",
  },

  veteran_charge: {
    name:           "Veteran Charge",
    description:    "Has charged real battle lines. On combat entry, the player acts first regardless of speed comparison for the opening turn.",
    effectCategory: "on_enter",
  },

  seized_ground: {
    name:           "Seized Ground",
    description:    "A warhorse trained to hold a fixed position. Increases the rider's defense by 8 while mounted in combat.",
    effectCategory: "passive_stat",
  },

  the_work_continues: {
    name:           "The Work Continues",
    description:    "Rode out of Honnoji at dawn and kept moving. At the start of each combat, restores 5% of the player's max HP.",
    effectCategory: "on_enter",
  },

  // ═════════════════════════════════════════════════════════════════════
  // Companion skills
  // ═════════════════════════════════════════════════════════════════════

  counter_read: {
    name:           "Counter Read",
    description:    "Nohime anticipates the enemy's next move. On any turn she is in party, incoming attack damage is reduced by 8%.",
    effectCategory: "counter",
  },

  false_position: {
    name:           "False Position",
    description:    "Nohime (Intelligence) creates a tactical diversion. Once per combat, forces the enemy to target her instead of the player for one turn.",
    effectCategory: "on_enter",
  },

  measured_strike: {
    name:           "Measured Strike",
    description:    "Mitsuhide never wastes an opening. His attacks deal +12% damage on the turn immediately following a player miss.",
    effectCategory: "on_hit",
  },

  last_counsel: {
    name:           "Last Counsel",
    description:    "Mitsuhide (Resolved) has seen every road and made his choice. When the player's HP falls below 30%, he intercepts the next hit, absorbing up to 40 damage.",
    effectCategory: "on_low_hp",
  },

  // ═════════════════════════════════════════════════════════════════════
  // Pet skills
  // ═════════════════════════════════════════════════════════════════════

  court_presence: {
    name:           "Court Presence",
    description:    "A trained diplomatic bird. Reduces enemy morale at combat start, lowering their attack by 6% for the first 3 turns.",
    effectCategory: "debuff_aura",
  },

  omen_sense: {
    name:           "Omen Sense",
    description:    "The mountain fox reads the air before battle. Gives a 20% chance to warn the player of an ambush, preventing enemy first-strike.",
    effectCategory: "on_enter",
  },

  nohimes_eye: {
    name:           "Nohime's Eye",
    description:    "Named by Nohime herself. The crane has absorbed something of her watchfulness. Increases the player's dex-derived dodge chance by 5%.",
    effectCategory: "passive_stat",
  },

  survivors_weight: {
    name:           "Survivor's Weight",
    description:    "A sparrow from the Honnoji rubble. Carries something that can't be named. The player gains +8% EXP from all combats while this pet is active.",
    effectCategory: "passive_aura",
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// Public accessors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up the description for a skill key.
 *
 * Returns undefined for unknown keys rather than throwing, so callers can
 * gracefully fall back to displaying the raw key in the UI.
 */
export function getSkillDescription(skillKey: string): SkillDescription | undefined {
  return SKILL_DESCRIPTIONS[skillKey];
}

/**
 * Returns the human-readable skill name only.  Convenience wrapper used by
 * the inventory panel tooltip (Part 10) where only the name is needed.
 *
 * Falls back to a title-cased version of the key if the key is not registered,
 * so unknown keys always render as something sensible.
 */
export function getSkillName(skillKey: string): string {
  const entry = SKILL_DESCRIPTIONS[skillKey];
  if (entry) return entry.name;
  // Graceful fallback: "veteran_charge" → "Veteran Charge"
  return skillKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Returns all registered skill keys.  Used by combat.ts to validate at
 * startup that every key in the DB catalogue has a registered handler.
 */
export function getAllSkillKeys(): string[] {
  return Object.keys(SKILL_DESCRIPTIONS);
}

/**
 * Returns every skill entry with its key.  Used by the admin / dev panel
 * to list all registered skills without needing direct map access.
 */
export function getAllSkills(): Array<{ key: string } & SkillDescription> {
  return Object.entries(SKILL_DESCRIPTIONS).map(([key, val]) => ({ key, ...val }));
}
