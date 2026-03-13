import { pick } from "../utils";
import {
  CLASSIC_DROPS, HORSE_RARITY_STATS, HORSE_NAMES, PET_NAMES,
} from "../constants/items";
import { YOKAI_NAMES, JP_BOSS_NAMES, CN_BOSS_NAMES, SPECIAL_BOSSES } from "../constants/enemies";

export function calcEquipExpToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

export function generatePet(userId: string, locationId: number = 1) {
  const pInfo  = pick(PET_NAMES);
  const r      = Math.random();
  const isChina = locationId >= 100;
  const bonus  = isChina ? (locationId - 100) * 0.05 + 0.1 : (locationId - 1) * 0.02;

  let rarity = 'white';
  if      (r > 0.99 - bonus / 2) rarity = 'primal';
  else if (r > 0.98 - bonus)     rarity = 'celestial';
  else if (r > 0.97 - bonus)     rarity = 'transcendent';
  else if (r > 0.96 - bonus)     rarity = 'exotic';
  else if (r > 0.90 - bonus)     rarity = 'mythic';
  else if (r > 0.75 - bonus)     rarity = 'gold';
  else if (r > 0.55 - bonus)     rarity = 'purple';
  else if (r > 0.35 - bonus)     rarity = 'blue';
  else if (r > 0.15 - bonus)     rarity = 'green';

  const statsByRarity: Record<string, { hp: number; atk: number; def: number; spd: number }> = {
    white:        { hp: 30,   atk: 5,   def: 5,   spd: 15  },
    green:        { hp: 50,   atk: 10,  def: 10,  spd: 25  },
    blue:         { hp: 80,   atk: 18,  def: 15,  spd: 35  },
    purple:       { hp: 120,  atk: 28,  def: 25,  spd: 50  },
    gold:         { hp: 200,  atk: 45,  def: 40,  spd: 75  },
    mythic:       { hp: 350,  atk: 75,  def: 65,  spd: 110 },
    exotic:       { hp: 600,  atk: 130, def: 110, spd: 160 },
    transcendent: { hp: 1000, atk: 220, def: 190, spd: 240 },
    celestial:    { hp: 1800, atk: 400, def: 350, spd: 380 },
    primal:       { hp: 3500, atk: 800, def: 700, spd: 600 },
  };

  const stats   = statsByRarity[rarity] ?? statsByRarity.white;
  const variance = () => 0.9 + Math.random() * 0.2;
  const locMult  = isChina ? 2 + (locationId - 100) * 0.5 : 1 + (locationId - 1) * 0.2;
  const hpValue  = Math.floor(stats.hp * locMult * variance());

  return {
    userId,
    name: pInfo.name,
    type: 'spirit',
    rarity,
    level: 1,
    experience: 0,
    expToNext: 100,
    hp: hpValue,
    maxHp: hpValue,
    attack:  Math.floor(stats.atk * locMult * variance()),
    defense: Math.floor(stats.def * locMult * variance()),
    speed:   Math.floor(stats.spd * locMult * variance()),
    skill:   pInfo.skill,
    isActive: false,
  };
}

export function generateEquipment(userId: string, locationId: number = 1, forceGood = false) {
  const categories  = Object.keys(CLASSIC_DROPS);
  const category    = pick(categories) as keyof typeof CLASSIC_DROPS;
  const itemDef     = pick(CLASSIC_DROPS[category]);
  const isSlotted   = Math.random() < (forceGood ? 0.1 : 0.01);
  const slots       = isSlotted ? (itemDef.slots || 0) : 0;
  const baseAtk     = (itemDef as any).atk || 0;
  const baseDef     = (itemDef as any).def || 0;
  const locMult     = 1 + (locationId - 1) * 0.1;

  let weaponType: string | null = null;
  if (category === 'weapon') {
    const lower = itemDef.name.toLowerCase();
    if (lower.includes('bow'))                                              weaponType = 'bow';
    else if (lower.includes('rod') || lower.includes('staff') || lower.includes('wand')) weaponType = 'staff';
    else if (lower.includes('knife') || lower.includes('cutter') || lower.includes('gauche')) weaponType = 'dagger';
    else weaponType = 'sword';
  }

  return {
    userId,
    name:         itemDef.name + (slots > 0 ? ` [${slots}]` : ""),
    type:         (itemDef as any).type || category,
    weaponType,
    level:        1,
    experience:   0,
    expToNext:    calcEquipExpToNext(1),
    attackBonus:  Math.floor(baseAtk * locMult),
    defenseBonus: Math.floor(baseDef * locMult),
    speedBonus:   0,
    hpBonus:      Math.floor(((itemDef as any).hp   || 0) * locMult),
    mdefBonus:    Math.floor(((itemDef as any).mdef || 0) * locMult),
    matkBonus:    (itemDef as any).matk || 0,
    cardSlots:    slots,
    isEquipped:   false,
  };
}

export function generateHorse(userId: string, locationId: number = 1) {
  const name    = pick(HORSE_NAMES);
  const r       = Math.random();
  const isChina = locationId >= 100;
  const bonus   = isChina ? (locationId - 100) * 0.05 + 0.1 : (locationId - 1) * 0.02;

  let rarity = 'white';
  // Field horses cap at purple; higher rarities come from combine
  if      (r > 0.95 - bonus) rarity = 'purple';
  else if (r > 0.80 - bonus) rarity = 'blue';
  else if (r > 0.55 - bonus) rarity = 'green';

  // Use the shared HORSE_RARITY_STATS constant (no more inline duplication)
  const stats    = HORSE_RARITY_STATS[rarity] ?? HORSE_RARITY_STATS.white;
  const variance = () => 0.9 + Math.random() * 0.2;

  return {
    userId,
    name:          `${rarity.toUpperCase()} ${name}`,
    rarity,
    level:         1,
    speedBonus:    Math.floor(stats.speed * variance()),
    attackBonus:   Math.floor(stats.atk   * variance()),
    defenseBonus:  Math.floor(stats.def   * variance()),
    isActive:      false,
  };
}

function makeBaseStats(lvl: number) {
  return {
    str: Math.floor(lvl * 1.5),
    agi: Math.floor(lvl * 1.2),
    vit: Math.floor(lvl * 1.3),
    int: Math.floor(lvl * 0.8),
    dex: Math.floor(lvl * 1.4),
    luk: Math.max(1, Math.floor(lvl * 0.5)),
  };
}

export function generateEnemyStats(
  type: 'field' | 'boss' | 'special',
  _playerLevel: number,
  locationId: number = 1,
) {
  let targetLevel: number;
  if (locationId >= 100) {
    targetLevel = 7 + (locationId - 101);
  } else {
    targetLevel = locationId;
  }
  const locationMultiplier = 1 + (targetLevel - 1) * 0.1;

  if (type === 'field') {
    const name = locationId >= 100
      ? pick(["Terracotta Guard", "Silk Road Bandit", "Mountain Cultivator"])
      : pick(YOKAI_NAMES);
    const lvl    = targetLevel;
    const stats  = makeBaseStats(lvl);
    const hardDEF   = Math.floor((lvl * 6  + 15)  * locationMultiplier);
    const weaponATK = Math.floor((lvl * 10 + 20)  * locationMultiplier);
    const hit  = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const flee = 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 40 + 100) * locationMultiplier),
      maxHp: Math.floor((lvl * 40 + 100) * locationMultiplier),
      attack: weaponATK, defense: hardDEF,
      speed: Math.floor((lvl * 5 + 10) * locationMultiplier),
      weaponType: 'none', ...stats, weaponATK, weaponLevel: 1, hardDEF, softDEF: 0, hit, flee,
      skills: ["Scratch", "Bite"],
    };
  }

  if (type === 'boss') {
    const name   = locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    const lvl    = targetLevel + 2;
    const stats  = makeBaseStats(lvl);
    stats.vit    = Math.floor(stats.vit * 1.3);
    stats.agi    = Math.floor(stats.agi * 1.2);
    const hardDEF   = Math.floor((lvl * 25 + 80)  * locationMultiplier);
    const weaponATK = Math.floor((lvl * 30 + 100) * locationMultiplier);
    const hit  = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const flee = 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 200 + 1000) * locationMultiplier),
      maxHp: Math.floor((lvl * 200 + 1000) * locationMultiplier),
      attack: weaponATK, defense: hardDEF,
      speed: Math.floor((lvl * 15 + 50) * locationMultiplier),
      weaponType: 'none', ...stats, weaponATK, weaponLevel: 2, hardDEF, softDEF: 0, hit, flee,
      skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  }

  // special boss
  const sb   = pick(SPECIAL_BOSSES);
  const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
  const lvl  = targetLevel + 5;
  const stats = makeBaseStats(lvl);
  stats.vit   = Math.floor(stats.vit * 1.6);
  stats.agi   = Math.floor(stats.agi * 1.3);
  stats.dex   = Math.floor(stats.dex * 1.2);
  const hardDEF   = Math.floor((lvl * 50  + 250) * locationMultiplier);
  const weaponATK = Math.floor((lvl * 60  + 300) * locationMultiplier);
  const hit  = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
  const flee = 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10);
  return {
    name, level: lvl,
    hp: Math.floor((lvl * 400 + 5000) * locationMultiplier),
    maxHp: Math.floor((lvl * 400 + 5000) * locationMultiplier),
    attack: weaponATK, defense: hardDEF,
    speed: Math.floor((lvl * 30 + 100) * locationMultiplier),
    weaponType: 'none', ...stats, weaponATK, weaponLevel: 3, hardDEF, softDEF: 0, hit, flee,
    skills: [sb.skill, "Roar", "Dark Aura", "Divine Intervention"],
  };
}

/**
 * Generate a ninja encounter scaled to locationId.
 *
 * Normal ninja  → scales like a field boss  (between field and boss tier)
 * Super-strong  → scales like a special boss (rare, much harder)
 *
 * Previously all ninjas used hardcoded hp:1000/5000, atk:100/500, def:50/300
 * regardless of location — a location-1 player faced the same enemy as a
 * China-110 player. Now stats track the same locationMultiplier used everywhere.
 */
export function generateNinjaStats(
  name: string,
  locationId: number,
  isSuperStrong: boolean,
  goldDemanded: number,
) {
  const targetLevel = locationId >= 100 ? 7 + (locationId - 101) : locationId;
  const locationMultiplier = 1 + (targetLevel - 1) * 0.1;

  const lvl = isSuperStrong ? targetLevel + 20 : targetLevel + 2;

  // Super-strong: special-boss scaling. Normal: field-boss scaling.
  const hp     = isSuperStrong
    ? Math.floor((lvl * 400 + 5000) * locationMultiplier)
    : Math.floor((lvl * 200 + 1000) * locationMultiplier);
  const attack = isSuperStrong
    ? Math.floor((lvl * 60  + 300)  * locationMultiplier)
    : Math.floor((lvl * 30  + 100)  * locationMultiplier);
  const defense = isSuperStrong
    ? Math.floor((lvl * 50  + 250)  * locationMultiplier)
    : Math.floor((lvl * 25  + 80)   * locationMultiplier);
  const speed  = isSuperStrong
    ? Math.floor((lvl * 30  + 100)  * locationMultiplier)
    : Math.floor((lvl * 15  + 50)   * locationMultiplier);

  return {
    name,
    level:        lvl,
    hp,
    maxHp:        hp,
    attack,
    defense,
    speed,
    skills:       ["Shadow Strike", "Smoke Bomb", "Assassinate"],
    isNinja:      true,
    goldDemanded,
  };
}

export function equipRarityFromRandom(locationId: number = 1): string {
  const r       = Math.random();
  const isChina = locationId >= 100;
  if (isChina) {
    const bonus = (locationId - 100) * 0.02;
    if (r > 0.985 - bonus) return 'celestial';
    if (r > 0.965 - bonus) return 'transcendent';
    if (r > 0.92  - bonus) return 'exotic';
    if (r > 0.80  - bonus) return 'mythic';
    if (r > 0.60  - bonus) return 'gold';
    if (r > 0.40  - bonus) return 'purple';
    if (r > 0.20  - bonus) return 'blue';
    if (r > 0.10  - bonus) return 'green';
    return 'white';
  }
  const bonus = (locationId - 1) * 0.03;
  if (r > 0.995 - bonus / 5) return 'celestial';
  if (r > 0.985 - bonus / 2) return 'transcendent';
  if (r > 0.95  - bonus)     return 'exotic';
  if (r > 0.85  - bonus)     return 'mythic';
  if (r > 0.70  - bonus)     return 'gold';
  if (r > 0.50  - bonus)     return 'purple';
  if (r > 0.30  - bonus)     return 'blue';
  if (r > 0.15  - bonus)     return 'green';
  return 'white';
}
