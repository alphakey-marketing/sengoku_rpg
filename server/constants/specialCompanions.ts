/**
 * specialCompanions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Catalogue of historical companions that can only be obtained by reaching
 * a story flag threshold at the end of a specific chapter.
 *
 * Rules:
 *  - flagKey / threshold: the player's accumulated flag score must be >= threshold.
 *    Negative thresholds are supported (e.g. supernatural_affinity >= 3).
 *  - chapterId: the chapter whose completion triggers the check.
 *  - isSpecial: always true — used by the dedup check in storage to prevent
 *    a second copy appearing if the player replays the chapter.
 *  - Stats are intentionally strong but not broken; these are rare rewards.
 */

export interface SpecialCompanionDef {
  /** The flag key that gates this companion */
  flagKey:    string;
  /** Minimum flag value required (inclusive) */
  threshold:  number;
  /** Chapter completion that triggers the check */
  chapterId:  number;
  /** Displayed in the "Joined your clan!" banner */
  name:       string;
  type:       string;
  rarity:     string;
  level:      number;
  hp:         number;
  maxHp:      number;
  attack:     number;
  defense:    number;
  speed:      number;
  skill:      string;
  /** Flavour description shown in the unlock banner */
  unlockMessage: string;
}

export const SPECIAL_COMPANIONS: SpecialCompanionDef[] = [
  // ─── Akechi Mitsuhide ──────────────────────────────────────────────────────
  // Unlocked by high mitsuhide_loyalty at the end of Chapter 2.
  // Represents the player having treated him with consistent respect.
  {
    flagKey:       "mitsuhide_loyalty",
    threshold:     4,
    chapterId:     2,
    name:          "Akechi Mitsuhide",
    type:          "Tactician",
    rarity:        "legendary",
    level:         1,
    hp:            120,
    maxHp:         120,
    attack:        28,
    defense:       35,
    speed:         22,
    skill:         "Meticulous Plan: reduces incoming damage by 20% for 2 turns",
    unlockMessage: "Mitsuhide pledges his unwavering loyalty. His careful mind joins your cause.",
  },

  // ─── Toyotomi Hideyoshi ────────────────────────────────────────────────────
  // Unlocked by high hideyoshi_loyalty at the end of Chapter 3.
  // Represents recognising his talent early and elevating him.
  {
    flagKey:       "hideyoshi_loyalty",
    threshold:     4,
    chapterId:     3,
    name:          "Toyotomi Hideyoshi",
    type:          "Strategist",
    rarity:        "legendary",
    level:         1,
    hp:            100,
    maxHp:         100,
    attack:        32,
    defense:       28,
    speed:         30,
    skill:         "Monkey's Wit: +25% gold gained after victory",
    unlockMessage: "Hideyoshi grins and vows to repay your faith tenfold.",
  },

  // ─── Tokugawa Ieyasu ──────────────────────────────────────────────────────
  // Unlocked by high ieyasu_loyalty at the end of Chapter 4.
  // Represents a patient, alliance-first approach to Mikawa.
  {
    flagKey:       "ieyasu_loyalty",
    threshold:     4,
    chapterId:     4,
    name:          "Tokugawa Ieyasu",
    type:          "Warrior",
    rarity:        "legendary",
    level:         1,
    hp:            160,
    maxHp:         160,
    attack:        30,
    defense:       40,
    speed:         18,
    skill:         "Tanuki's Patience: +15% DEF to all party members",
    unlockMessage: "Ieyasu clasps your arm. \"I follow the strongest pillar.\"",
  },

  // ─── Nohime ───────────────────────────────────────────────────────────────
  // Unlocked by pursuing the supernatural path (Chapter 1).
  // She senses the cursed blade's resonance and seeks you out.
  {
    flagKey:       "supernatural_affinity",
    threshold:     3,
    chapterId:     1,
    name:          "Nohime",
    type:          "Spirit Caller",
    rarity:        "epic",
    level:         1,
    hp:            90,
    maxHp:         90,
    attack:        40,
    defense:       20,
    speed:         35,
    skill:         "Spirit Bind: 15% chance to stun enemy for 1 turn",
    unlockMessage: "Nohime emerges from the shadows, drawn by the cursed blade's resonance.",
  },

  // ─── Mori Ranmaru ─────────────────────────────────────────────────────────
  // Unlocked by the most ruthless playthrough of Chapter 1.
  // He respects only strength and absolute conviction.
  {
    flagKey:       "ruthlessness",
    threshold:     6,
    chapterId:     1,
    name:          "Mori Ranmaru",
    type:          "Bodyguard",
    rarity:        "epic",
    level:         1,
    hp:            110,
    maxHp:         110,
    attack:        45,
    defense:       25,
    speed:         32,
    skill:         "Demon's Resolve: +10% ATK for every ally that falls in battle",
    unlockMessage: "Ranmaru steps forward, eyes burning. \"I serve only the Demon King.\"",
  },
];
