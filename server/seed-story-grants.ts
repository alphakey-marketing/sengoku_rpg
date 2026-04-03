/**
 * server/seed-story-grants.ts
 *
 * Seeds the `story_grants` catalogue table with every story-driven reward
 * defined for chapters 1–8.  Idempotent — skips any grant whose `grantKey`
 * is already present.  Safe to call on every server startup.
 *
 * Called from server/index.ts after runMigrations() and seedStoryChapters().
 *
 * GRANT KEY NAMING CONVENTION
 * ───────────────────────────
 * grant_<category>_<short_name>
 *   category  ∈ { companion, equip, pet, horse }
 *   short_name is snake_case and matches the design doc.
 *
 * CONDITION GRAMMAR (flagCondition column)
 * ─────────────────────────────────────────
 * Single condition:  "flagKey>=value"  (parsed by evalUnlockCondition in schema.ts)
 * Compound AND:      expressed as two separate grant rows where the second has
 *                    `upgradeOf` pointing at the first.  The evaluator issues
 *                    both only when both conditions pass.
 * Unconditional:     null  (awarded to every player who completes the chapter)
 */

import { db } from "./db";
import { storyGrants, type InsertStoryGrant } from "../shared/schema";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue definition
// ─────────────────────────────────────────────────────────────────────────────

const GRANTS: InsertStoryGrant[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 1 — The Fool of Owari
  // ══════════════════════════════════════════════════════════════════════════

  {
    // Blade-keeper path: player chose "Send men to retrieve it" at S05 (supernatural_affinity +2).
    // Scene S06A then writes weapon_legacy +1 and omen_read +1 unconditionally.
    // This grant is the base item for the Ch5 upgrade chain (singing-blade path only):
    //   grant_weapon_singing_blade → grant_weapon_reforged_blade (upgradeOf)
    // flagCondition is "supernatural_affinity>=2" which exclusively identifies the
    // blade-keeper path. The Ch5 upgrade grant mirrors this condition so the
    // upgradeOf pointer is never dangling.
    grantKey:       "grant_weapon_singing_blade",
    displayName:    "The Singing Blade",
    flavourText:    "Unearthed at Nagashino. Three men died holding it. You picked it up yourself.",
    chapterTrigger: 1,
    flagCondition:  "supernatural_affinity>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:             "equipment",
      name:                 "The Singing Blade",
      type:                 "weapon",
      rarity:               "rare",
      weaponType:           "katana",
      attackBonus:          18,
      defenseBonus:         0,
      speedBonus:           2,
      hpBonus:              0,
      mdefBonus:            0,
      fleeBonus:            0,
      matkBonus:            0,
      critChance:           4,
      critDamage:           14,
      cardSlots:            1,
      passiveDescription:   "Hums faintly in the dark. The first weapon that chose you.",
      storyFlagRequirement: "supernatural_affinity>=2",
    },
    upgradeOf: null,
  },

  {
    // Blade-burner path: player chose "Destroy it" at S05 (supernatural_affinity -1, mitsuhide_loyalty +1).
    // Scene S06B narrates the stray dog joining the column — this grant closes that loop.
    // Condition uses supernatural_affinity<=-1 to target exclusively the burn path.
    // Ensures every Ch1 path receives at least one inventory grant.
    grantKey:       "grant_pet_nagashino_dog",
    displayName:    "The Road Dog",
    flavourText:    "It followed the column from Nagashino ash. Nobody sent it away.",
    chapterTrigger: 1,
    flagCondition:  "supernatural_affinity<=-1",
    grantCategory:  "pet",
    grantPayload: {
      category:  "pet",
      name:      "The Road Dog",
      type:      "dog",
      rarity:    "common",
      hp:        28,
      maxHp:     28,
      attack:    8,
      defense:   10,
      speed:     14,
      skill:     "road_follower",
    },
    upgradeOf: null,
  },

  {
    // Victory path: Ch1 S09_WIN fires when the player wins the Okehazama battle.
    // flag-registry road_command entry: "horse named after Okehazama (Ch1 S09_WIN)".
    // S09_WIN is the isChapterEnd scene reached after a battle win — road_command
    // is set +1 by the S09_WIN flagWrites block in chapter_01.json.
    // No horse grant existed for Ch1 winners; this fills that gap.
    // Condition: road_command>=1 (exclusively written by S09_WIN at this chapter).
    grantKey:       "grant_horse_ch1_victory",
    displayName:    "Okehazama's Shadow",
    flavourText:    "Stabled at Kiyosu since the battle. The groom said it refuses every rider but one.",
    chapterTrigger: 1,
    flagCondition:  "road_command>=1",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "Okehazama's Shadow",
      rarity:       "uncommon",
      speedBonus:   14,
      attackBonus:  4,
      defenseBonus: 2,
      skill:        "okehazama_memory",
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 2 — The Alliance of Wolves
  // ══════════════════════════════════════════════════════════════════════════

  {
    // S06_KEEP path: player chose "Keep it. A weapon offered by someone watching this
    // closely is worth understanding." — sets weapon_legacy+1.
    // flag-registry weapon_legacy entry explicitly lists Ch2 as a write source with
    // the note "mystery gift accepted (Ch2 S06 micro-beat)".
    // The anonymous short sword is described in the scene in detail ("old, well-kept,
    // no maker's mark") — it is the grant object. No equipment grant existed for this path.
    // Condition: weapon_legacy>=1 at Ch2 completion.
    // chapterTrigger=2 prevents this from double-firing with the Ch1 weapon_legacy write;
    // the evaluator only loads candidates WHERE chapter_trigger = chapterNumber.
    grantKey:       "grant_weapon_anonymous_sword",
    displayName:    "The Anonymous Sword",
    flavourText:    "No maker's mark. Old, well-kept. Whoever sent it knew enough to send something a warlord might actually carry.",
    chapterTrigger: 2,
    flagCondition:  "weapon_legacy>=1",
    grantCategory:  "equipment",
    grantPayload: {
      category:             "equipment",
      name:                 "The Anonymous Sword",
      type:                 "weapon",
      rarity:               "uncommon",
      weaponType:           "sword",
      attackBonus:          15,
      defenseBonus:         2,
      speedBonus:           1,
      hpBonus:              0,
      mdefBonus:            0,
      fleeBonus:            0,
      matkBonus:            0,
      critChance:           3,
      critDamage:           10,
      cardSlots:            1,
      passiveDescription:   "From an unknown hand. The sender is still watching.",
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  {
    // S05A path: player chose "March to meet him — stand in front of him personally."
    // Scene S05A has flagWrites: road_command+1.
    // flag-registry road_command entry notes "war-horse presence at Nobuyasu standoff
    // (Ch2 S05A)" as a source write. The scene narration gives the horse two full
    // descriptive lines: "a good animal, calm under the noise of four thousand men...
    // The horse is a sentence in the same letter." — this is clearly a grant beat.
    // No horse grant existed for the S05A path.
    //
    // FIX (Bug 3): Condition raised from "road_command>=1" to "road_command>=2".
    // Players who won Okehazama in Ch1 already enter Ch2 with road_command=1.
    // Using >=1 caused both grant_horse_ch1_victory (Ch1) and this grant (Ch2) to
    // fire for anyone who then took S05A, resulting in two uncommon horses by Ch2.
    // road_command>=2 correctly targets only players who earned it in BOTH chapters.
    grantKey:       "grant_horse_nobuyasu_road",
    displayName:    "The Border Horse",
    flavourText:    "Calm under the noise of four thousand men. A sentence in a letter written by presence alone.",
    chapterTrigger: 2,
    flagCondition:  "road_command>=2",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "The Border Horse",
      rarity:       "uncommon",
      speedBonus:   12,
      attackBonus:  3,
      defenseBonus: 5,
      skill:        "standing_ground",
    },
    upgradeOf: null,
  },

  {
    // Ieyasu companion: awarded when ieyasu_trust>=2 at Ch2 completion.
    // ieyasu_trust is exclusively written in Ch2 (S03 choice: "Accept all three terms",
    // flagValue: 2; or S05B, flagValue: +1 stacked). It is not written by any earlier chapter.
    // Pattern: every chapter where a major ally is cultivated (Ch3 Nohime at nohime_trust>=2,
    // Ch4 Mitsuhide at mitsuhide_loyalty>=2, Ch7 Mitsuhide Resolved at mitsuhide_loyalty>=2)
    // awards them as a companion. Ieyasu is Ch2's primary cultivatable ally.
    // Condition: ieyasu_trust>=2 — requires the full-trust S03A path ("Accept all three terms").
    grantKey:       "grant_companion_ieyasu",
    displayName:    "Tokugawa Ieyasu",
    flavourText:    "He arrived exactly on time. He always does. The Kiyosu Alliance sealed in under four minutes.",
    chapterTrigger: 2,
    flagCondition:  "ieyasu_trust>=2",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Tokugawa Ieyasu",
      type:                "tactician",
      rarity:              "rare",
      hp:                  85,
      maxHp:               85,
      attack:              24,
      defense:             30,
      speed:               16,
      dex:                 22,
      agi:                 16,
      skill:               "patient_hold",
      isSpecial:           true,
      flagUnlockCondition: "ieyasu_trust>=2",
    },
    upgradeOf: null,
  },

  {
    // Katsuie companion: awarded when katsuie_loyalty>=2 at Ch2 completion.
    // katsuie_loyalty is written by Ch2 S04 choices and (later) Ch4.
    // At Ch2 the maximum is 2 (S04A: "Grant him the council seat with real authority").
    // Katsuie is the secondary cultivatable ally in Ch2 — Ieyasu and Katsuie are
    // mutually exclusive at the >=2 threshold (both require different S03/S04 choices
    // that cost ieyasu_trust, making it practically impossible to hit both >=2 in one run).
    // Condition: katsuie_loyalty>=2 — requires the full-authority S04A path.
    grantKey:       "grant_companion_katsuie",
    displayName:    "Shibata Katsuie",
    flavourText:    "He presented a campaign plan instead of a thank-you. That is how Katsuie says thank you.",
    chapterTrigger: 2,
    flagCondition:  "katsuie_loyalty>=2",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Shibata Katsuie",
      type:                "warrior",
      rarity:              "rare",
      hp:                  110,
      maxHp:               110,
      attack:              35,
      defense:             32,
      speed:               10,
      dex:                 14,
      agi:                 10,
      skill:               "north_wall",
      isSpecial:           true,
      flagUnlockCondition: "katsuie_loyalty>=2",
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 3 — The Mino Gambit
  // ══════════════════════════════════════════════════════════════════════════

  {
    grantKey:       "grant_horse_dosan",
    displayName:    "Dosan's Ghost",
    flavourText:    "A grey road stallion. The old man who asked you to take Mino by force never saw it used.",
    chapterTrigger: 3,
    flagCondition:  "ruthlessness>=1",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "Dosan's Ghost",
      rarity:       "uncommon",
      speedBonus:   18,
      attackBonus:  5,
      defenseBonus: 0,
      skill:        "border_road",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_companion_nohime",
    displayName:    "Nohime",
    flavourText:    "She was always there. The heron moment on the road was when she chose you.",
    chapterTrigger: 3,
    flagCondition:  "nohime_trust>=2",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Nohime",
      type:                "intelligence",
      rarity:              "rare",
      hp:                  80,
      maxHp:               80,
      attack:              18,
      defense:             22,
      speed:               20,
      dex:                 28,
      agi:                 25,
      skill:               "counter_read",
      isSpecial:           true,
      flagUnlockCondition: "nohime_trust>=2",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_pet_court_crane",
    displayName:    "Court Crane",
    flavourText:    "Mitsuhide brought it back from the border. A trained white crane, a diplomat's symbol.",
    chapterTrigger: 3,
    flagCondition:  "mitsuhide_loyalty>=1",
    grantCategory:  "pet",
    grantPayload: {
      category:  "pet",
      name:      "Court Crane",
      type:      "bird",
      rarity:    "uncommon",
      hp:        30,
      maxHp:     30,
      attack:    6,
      defense:   8,
      speed:     18,
      skill:     "court_presence",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_weapon_captains_jitte",
    displayName:    "Captain's Jitte",
    flavourText:    "Taken from the border captain. Heavy steel, practical, no ceremony.",
    chapterTrigger: 3,
    flagCondition:  "nohime_witnessed_win==1",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Captain's Jitte",
      type:                "weapon",
      rarity:              "uncommon",
      weaponType:          "jitte",
      attackBonus:         14,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          3,
      critDamage:          10,
      cardSlots:           1,
      passiveDescription:  null,
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 4 — The Monk's Fire
  // ══════════════════════════════════════════════════════════════════════════

  {
    grantKey:       "grant_horse_okehazama",
    displayName:    "Okehazama",
    flavourText:    "The horse that has been to Okehazama and back. He lent it to Mitsuhide for the road.",
    chapterTrigger: 4,
    flagCondition:  "road_command>=1",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "Okehazama",
      rarity:       "rare",
      speedBonus:   15,
      attackBonus:  8,
      defenseBonus: 0,
      skill:        "veteran_charge",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_weapon_katsuie_sword",
    displayName:    "Katsuie's Short Sword",
    flavourText:    "Plain campaign steel. Katsuie doesn't give things lightly.",
    chapterTrigger: 4,
    flagCondition:  "katsuie_loyalty>=1",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Katsuie's Short Sword",
      type:                "weapon",
      rarity:              "uncommon",
      weaponType:          "sword",
      attackBonus:         18,
      defenseBonus:        4,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          4,
      critDamage:          12,
      cardSlots:           1,
      passiveDescription:  null,
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_companion_mitsuhide",
    displayName:    "Akechi Mitsuhide",
    flavourText:    "Loyalty restored by grief acknowledged. The shared victory crystallised into a bond.",
    chapterTrigger: 4,
    flagCondition:  "mitsuhide_loyalty>=2",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Akechi Mitsuhide",
      type:                "tactician",
      rarity:              "rare",
      hp:                  90,
      maxHp:               90,
      attack:              32,
      defense:             28,
      speed:               14,
      dex:                 20,
      agi:                 14,
      skill:               "measured_strike",
      isSpecial:           true,
      flagUnlockCondition: "mitsuhide_loyalty>=2",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_equip_writing_case",
    displayName:    "Lacquer Writing Case",
    flavourText:    "Mitsuhide set it down and walked away. Gyokan's student, still carrying the tools of the first man who taught him precision.",
    chapterTrigger: 4,
    flagCondition:  "ruthlessness>=3",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Lacquer Writing Case",
      type:                "accessory",
      rarity:              "rare",
      weaponType:          null,
      attackBonus:         8,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Unlocks the Compose action in battle: inflicts a morale-debuff on the enemy, reducing their attack by 10% for 2 turns.",
      storyFlagRequirement: "ruthlessness>=3",
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 5 — The Mountain and the Mirror
  // ══════════════════════════════════════════════════════════════════════════

  {
    // FIX (Bug 1, path A — singing-blade lineage):
    // Narrowed flagCondition from "weapon_legacy>=1" to "supernatural_affinity>=2".
    //
    // Previously, flagCondition "weapon_legacy>=1" matched BOTH the Ch1 singing-blade
    // path (supernatural_affinity>=2, weapon_legacy written by S06A) AND the Ch2
    // anonymous-sword path (weapon_legacy written by S06_KEEP). This caused the
    // upgradeOf: "grant_weapon_singing_blade" pointer to hit an empty row for
    // anonymous-sword players — isSuperseded silently returned false, the old Ch2
    // weapon was never retired, and players received a duplicate weapon slot.
    //
    // "supernatural_affinity>=2" exclusively identifies the blade-keeper path,
    // so this entry now only fires for players who actually hold grant_weapon_singing_blade.
    grantKey:       "grant_weapon_reforged_blade",
    displayName:    "The Reforged Blade",
    flavourText:    "Returned by the Nagashino smith, stronger at the seam. It remembers what it survived.",
    chapterTrigger: 5,
    flagCondition:  "supernatural_affinity>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "The Reforged Blade",
      type:                "weapon",
      rarity:              "epic",
      weaponType:          "katana",
      attackBonus:         28,
      defenseBonus:        0,
      speedBonus:          4,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          6,
      critDamage:          20,
      cardSlots:           1,
      passiveDescription:  "Supersedes the Singing Blade. The reforged edge carries the omen forward.",
      storyFlagRequirement: "supernatural_affinity>=2",
    },
    upgradeOf: "grant_weapon_singing_blade",
  },

  {
    // FIX (Bug 1, path B — anonymous-sword lineage):
    // New parallel Ch5 entry to cover players who came through the Ch2 S06_KEEP path
    // (grant_weapon_anonymous_sword). These players have weapon_legacy>=1 but
    // supernatural_affinity<2, so the original grant_weapon_reforged_blade
    // (now narrowed to supernatural_affinity>=2) no longer matches them.
    //
    // flagCondition "weapon_legacy>=1" here safely targets only anonymous-sword
    // players because at chapterTrigger=5 the evaluator loads candidates WHERE
    // chapter_trigger=5 — and supernatural_affinity>=2 players are already claimed
    // by grant_weapon_reforged_blade above.
    //
    // upgradeOf: "grant_weapon_anonymous_sword" ensures isSuperseded correctly
    // retires the Ch2 sword and the didUpgrade flag is set to true on the response.
    grantKey:       "grant_weapon_reforged_blade_v2",
    displayName:    "The Reforged Blade",
    flavourText:    "The anonymous sword, returned by the mountain smith. Stronger at the seam. The sender's mark is still absent.",
    chapterTrigger: 5,
    flagCondition:  "weapon_legacy>=1",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "The Reforged Blade",
      type:                "weapon",
      rarity:              "epic",
      weaponType:          "katana",
      attackBonus:         28,
      defenseBonus:        0,
      speedBonus:          4,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          6,
      critDamage:          20,
      cardSlots:           1,
      passiveDescription:  "Supersedes the Anonymous Sword. The reforged edge carries weapon_legacy forward. The sender still watches.",
      storyFlagRequirement: "weapon_legacy>=1",
    },
    upgradeOf: "grant_weapon_anonymous_sword",
  },

  {
    grantKey:       "grant_pet_mountain_fox",
    displayName:    "Mountain Fox",
    flavourText:    "A fox crossed the inn road at dusk. Only those who kept silent and watched the omen saw it.",
    chapterTrigger: 5,
    flagCondition:  "omen_read>=2",
    grantCategory:  "pet",
    grantPayload: {
      category:  "pet",
      name:      "Mountain Fox",
      type:      "fox",
      rarity:    "rare",
      hp:        35,
      maxHp:     35,
      attack:    10,
      defense:   6,
      speed:     22,
      skill:     "omen_sense",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_equip_kenshin_cup",
    displayName:    "Kenshin's Tea Cup",
    flavourText:    "Left at the mountain inn. A reminder of the only honest assessment he ever received.",
    chapterTrigger: 5,
    flagCondition:  "bond_strength>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Kenshin's Tea Cup",
      type:                "accessory",
      rarity:              "rare",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             30,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Once per combat: if the player would die, restores 1 HP and prevents the killing blow.",
      storyFlagRequirement: "bond_strength>=2",
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 6 — Nohime's Gambit
  // ══════════════════════════════════════════════════════════════════════════

  {
    grantKey:       "grant_companion_nohime_intel",
    displayName:    "Nohime (Intelligence)",
    flavourText:    "She used herself as bait and you gave her full authority. The eastern network is hers.",
    chapterTrigger: 6,
    flagCondition:  "nohime_trust>=4",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Nohime",
      type:                "intelligence",
      rarity:              "epic",
      hp:                  95,
      maxHp:               95,
      attack:              22,
      defense:             28,
      speed:               24,
      dex:                 34,
      agi:                 30,
      skill:               "false_position",
      isSpecial:           true,
      flagUnlockCondition: "nohime_trust>=3",
    },
    upgradeOf: "grant_companion_nohime",
  },

  {
    grantKey:       "grant_equip_nohime_seal",
    displayName:    "Nohime's Seal",
    flavourText:    "You gave her your full authority. She wears it quietly, but everyone knows.",
    chapterTrigger: 6,
    flagCondition:  "nohime_trust>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Nohime's Seal",
      type:                "accessory",
      rarity:              "epic",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           15,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "All political_power flag-gate checks in non-combat screens count the player as +1 higher than their actual flag value.",
      storyFlagRequirement: "nohime_trust>=3",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_horse_eastern_stallion",
    displayName:    "Eastern Stallion",
    flavourText:    "One of the confiscated lords' warhorses. Part of the province forfeit.",
    chapterTrigger: 6,
    flagCondition:  "ruthlessness>=2",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "Eastern Stallion",
      rarity:       "uncommon",
      speedBonus:   12,
      attackBonus:  6,
      defenseBonus: 6,
      skill:        "seized_ground",
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 7 — The Price of Heaven
  // ══════════════════════════════════════════════════════════════════════════

  {
    grantKey:       "grant_equip_ashikaga_seal",
    displayName:    "Ashikaga Seal",
    flavourText:    "Yoshiaki's formal authorisation. The fiction that works, as long as everyone agrees to maintain it.",
    chapterTrigger: 7,
    flagCondition:  "political_power>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Ashikaga Seal",
      type:                "accessory",
      rarity:              "epic",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           10,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Reduces enemy ambush (first-strike) chance by 30%. The Yoshiaki path bought Nobunaga time; this seal buys you time.",
      storyFlagRequirement: "political_power>=3",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_pet_blue_crane",
    displayName:    "Blue Silk Crane",
    flavourText:    "Nohime named it without being asked. A rare ornamental crane from the Kyoto market.",
    chapterTrigger: 7,
    flagCondition:  "nohime_trust>=3",
    grantCategory:  "pet",
    grantPayload: {
      category:  "pet",
      name:      "Blue Silk Crane",
      type:      "bird",
      rarity:    "rare",
      hp:        28,
      maxHp:     28,
      attack:    5,
      defense:   7,
      speed:     20,
      skill:     "nohimes_eye",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_companion_mitsuhide_resolved",
    displayName:    "Akechi Mitsuhide (Resolved)",
    flavourText:    "\"I understand the roads now.\" After Yamazaki, he commits without remainder.",
    chapterTrigger: 7,
    flagCondition:  "mitsuhide_loyalty>=2",
    grantCategory:  "companion",
    grantPayload: {
      category:            "companion",
      name:                "Akechi Mitsuhide",
      type:                "tactician",
      rarity:              "epic",
      hp:                  110,
      maxHp:               110,
      attack:              38,
      defense:             34,
      speed:               16,
      dex:                 24,
      agi:                 16,
      skill:               "last_counsel",
      isSpecial:           true,
      flagUnlockCondition: "mitsuhide_loyalty>=2",
    },
    upgradeOf: "grant_companion_mitsuhide",
  },

  {
    grantKey:       "grant_equip_merchant_ledger",
    displayName:    "Kyoto Merchant's Ledger",
    flavourText:    "\"Keep the roads open, my lord.\" He gave it as thanks after you told him your name.",
    chapterTrigger: 7,
    flagCondition:  "nohime_trust>=1",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Kyoto Merchant's Ledger",
      type:                "accessory",
      rarity:              "uncommon",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           10,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Passive: +15% gold gain from all battle drops.",
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 8 — Honnoji
  // ══════════════════════════════════════════════════════════════════════════

  {
    grantKey:       "grant_horse_dawn_road",
    displayName:    "Dawn Road",
    flavourText:    "The horse he rides out of Honnoji at dawn. The work continues.",
    chapterTrigger: 8,
    flagCondition:  "political_power>=2",
    grantCategory:  "horse",
    grantPayload: {
      category:     "horse",
      name:         "Dawn Road",
      rarity:       "epic",
      speedBonus:   20,
      attackBonus:  0,
      defenseBonus: 8,
      skill:        "the_work_continues",
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_equip_final_order",
    displayName:    "The Final Order",
    flavourText:    "Three lines, sealed, thrown through a window. Historians argue for four hundred years about what he meant.",
    chapterTrigger: 8,
    flagCondition:  "nohime_trust>=1",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "The Final Order",
      type:                "accessory",
      rarity:              "epic",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           20,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Passive aura: all companions in party gain +5% experience. The order that outlasted its author.",
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  {
    grantKey:       "grant_pet_honnoji_sparrow",
    displayName:    "Honnoji Sparrow",
    flavourText:    "It landed on the temple rubble at dawn. Only those who survived and understood the cost will see it.",
    chapterTrigger: 8,
    flagCondition:  "mitsuhide_loyalty>=2",
    grantCategory:  "pet",
    grantPayload: {
      category:  "pet",
      name:      "Honnoji Sparrow",
      type:      "bird",
      rarity:    "epic",
      hp:        25,
      maxHp:     25,
      attack:    4,
      defense:   6,
      speed:     24,
      skill:     "survivors_weight",
    },
    upgradeOf: null,
  },

  {
    // Loss-path exclusive: awarded on ch8 battle defeat + political_power >= 4
    grantKey:       "grant_equip_seal_ring",
    displayName:    "Nobunaga's Seal Ring",
    flavourText:    "Found in the ashes. The structures survive the man.",
    chapterTrigger: 8,
    flagCondition:  "political_power>=4",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Nobunaga's Seal Ring",
      type:                "accessory",
      rarity:              "legendary",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          5,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Passive: +10% EXP gain for the player. The enduring legacy of the man who built the structures.",
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

  {
    // Ruthlessness path: conditional narrator line fires at ruthlessness >= 4
    grantKey:       "grant_weapon_temple_brand",
    displayName:    "Temple Brand",
    flavourText:    "A fire-scorched tanto from the Honnoji inner hall. The last thing left in a burning room.",
    chapterTrigger: 8,
    flagCondition:  "ruthlessness>=4",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Temple Brand",
      type:                "weapon",
      rarity:              "epic",
      weaponType:          "tanto",
      attackBonus:         24,
      defenseBonus:        0,
      speedBonus:          6,
      hpBonus:             0,
      mdefBonus:           0,
      fleeBonus:           0,
      matkBonus:           0,
      critChance:          8,
      critDamage:          25,
      cardSlots:           1,
      passiveDescription:  "Weapon of last resort. Ruthlessness path only.",
      storyFlagRequirement: "ruthlessness>=4",
    },
    upgradeOf: null,
  },

  {
    // Ch8 survival (win) + political_power >= 2 — mirrors grant_horse_dawn_road trigger
    // Separate from grant_equip_final_order (which is nohime_trust path)
    // This grant is the S03A choice reward (send Ranmaru with Hideyoshi's name)
    grantKey:       "grant_equip_ranmaru_cloth",
    displayName:    "Ranmaru's Message Cloth",
    flavourText:    "A strip of cloth with one name on it. \"Go. Don't look back. The work continues.\"",
    chapterTrigger: 8,
    flagCondition:  "political_power>=2",
    grantCategory:  "equipment",
    grantPayload: {
      category:            "equipment",
      name:                "Ranmaru's Message Cloth",
      type:                "accessory",
      rarity:              "rare",
      weaponType:          null,
      attackBonus:         0,
      defenseBonus:        0,
      speedBonus:          0,
      hpBonus:             20,
      mdefBonus:           0,
      fleeBonus:           8,
      matkBonus:           0,
      critChance:          0,
      critDamage:          0,
      cardSlots:           0,
      passiveDescription:  "Passive: companion EXP gain +3%. A reminder that the work outlasts the person who starts it.",
      storyFlagRequirement: null,
    },
    upgradeOf: null,
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function seedStoryGrants(): Promise<void> {
  console.log("[seed-grants] Checking story grant catalogue...");

  let seeded = 0;
  let skipped = 0;

  for (const grant of GRANTS) {
    const existing = await db
      .select({ id: storyGrants.id })
      .from(storyGrants)
      .where(eq(storyGrants.grantKey, grant.grantKey))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(storyGrants).values(grant);
    console.log(`[seed-grants] ✨  Seeded: ${grant.grantKey}`);
    seeded++;
  }

  console.log(
    `[seed-grants] Done. ${seeded} grant(s) seeded, ${skipped} already present.`,
  );
}
