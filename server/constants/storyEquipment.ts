/**
 * storyEquipment.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Named historical equipment that can only appear in gacha drops once
 * the player's story flags cross the required threshold.
 *
 * Design rules:
 *  - Stats are at or slightly above the equivalent named-pool rarity so
 *    the item feels meaningful but not game-breaking.
 *  - storyFlavour is shown in the pull result card.
 *  - Each item is tied to a single flagKey / threshold; a player who
 *    never made those choices will never see these items in their pool.
 */

export interface SpecialEquipmentDef {
  name:              string;
  type:              string;         // 'weapon' | 'armor' | 'accessory' | 'horse_gear'
  weaponType?:       string | null;  // Only for weapons
  rarity:            string;
  /** Base ATK bonus before locationId multiplier */
  atk:               number;
  /** Base DEF bonus before locationId multiplier */
  def:               number;
  spd:               number;
  hp:                number;
  matk:              number;
  mdef:              number;
  storyFlagKey:      string;
  storyFlagThreshold: number;
  storyFlavour:      string;
}

export const STORY_EQUIPMENT: SpecialEquipmentDef[] = [
  // ── supernatural_affinity path ──────────────────────────────────────────
  {
    name:               "Cursed Blade Nagashino",
    type:               "weapon",
    weaponType:         "sword",
    rarity:             "exotic",
    atk:                120,
    def:                0,
    spd:                20,
    hp:                 0,
    matk:               0,
    mdef:               0,
    storyFlagKey:       "supernatural_affinity",
    storyFlagThreshold: 3,
    storyFlavour:       "The blade retrieved from the spirit world. It hums with cursed energy.",
  },
  {
    name:               "Spirit Binding Magatama",
    type:               "accessory",
    weaponType:         null,
    rarity:             "mythic",
    atk:                0,
    def:                30,
    spd:                40,
    hp:                 150,
    matk:               0,
    mdef:               25,
    storyFlagKey:       "supernatural_affinity",
    storyFlagThreshold: 2,
    storyFlavour:       "A jade bead carved with spirit-binding wards. Nohime's doing.",
  },

  // ── ruthlessness path ─────────────────────────────────────────────────
  {
    name:               "Demon King's Armour",
    type:               "armor",
    weaponType:         null,
    rarity:             "exotic",
    atk:                0,
    def:                95,
    spd:                0,
    hp:                 300,
    matk:               0,
    mdef:               40,
    storyFlagKey:       "ruthlessness",
    storyFlagThreshold: 4,
    storyFlavour:       "Black lacquered steel etched with Nobunaga's crests. Fear precedes it.",
  },
  {
    name:               "Honnoji Torch",
    type:               "weapon",
    weaponType:         "sword",
    rarity:             "transcendent",
    atk:                210,
    def:                0,
    spd:                0,
    hp:                 0,
    matk:               0,
    mdef:               0,
    storyFlagKey:       "ruthlessness",
    storyFlagThreshold: 8,
    storyFlavour:       "Forged from the ruins of Honnoji. Only the most ruthless lord can wield it.",
  },

  // ── mitsuhide_loyalty path ───────────────────────────────────────────
  {
    name:               "Meticulous Tactician's Scroll",
    type:               "accessory",
    weaponType:         null,
    rarity:             "gold",
    atk:                0,
    def:                50,
    spd:                0,
    hp:                 200,
    matk:               0,
    mdef:               60,
    storyFlagKey:       "mitsuhide_loyalty",
    storyFlagThreshold: 2,
    storyFlavour:       "Mitsuhide's personal battle notes. Comprehensive to the last stroke.",
  },
  {
    name:               "Nagamasa's Crescent Helm",
    type:               "armor",
    weaponType:         null,
    rarity:             "mythic",
    atk:                0,
    def:                70,
    spd:                0,
    hp:                 250,
    matk:               0,
    mdef:               35,
    storyFlagKey:       "mitsuhide_loyalty",
    storyFlagThreshold: 3,
    storyFlavour:       "Recovered by Mitsuhide at Omi. A gift for a lord he trusts.",
  },

  // ── hideyoshi_loyalty path ───────────────────────────────────────────
  {
    name:               "Monkey King's War Fan",
    type:               "accessory",
    weaponType:         null,
    rarity:             "gold",
    atk:                45,
    def:                20,
    spd:                30,
    hp:                 0,
    matk:               0,
    mdef:               0,
    storyFlagKey:       "hideyoshi_loyalty",
    storyFlagThreshold: 2,
    storyFlavour:       "Hideyoshi's iron war fan. Lighter than it looks, deadlier than it seems.",
  },

  // ── ieyasu_loyalty path ──────────────────────────────────────────────
  {
    name:               "Tortoiseshell War Do",
    type:               "armor",
    weaponType:         null,
    rarity:             "mythic",
    atk:                0,
    def:                85,
    spd:                0,
    hp:                 400,
    matk:               0,
    mdef:               45,
    storyFlagKey:       "ieyasu_loyalty",
    storyFlagThreshold: 2,
    storyFlavour:       "Ieyasu's own body armour, gifted as proof of the alliance.",
  },
];
