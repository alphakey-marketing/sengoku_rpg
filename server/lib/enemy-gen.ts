// ─── Name pools ──────────────────────────────────────────────────────────────
const JP_ENEMY_NAMES = ["Ashigaru","Ronin","Bandit","Mercenary","Scout","Raider","Footsoldier","Brigand"];
const CN_ENEMY_NAMES = ["Soldier","Conscript","Raider","Bandit","Scout","Mercenary","Rebel","Warlord's Guard"];
const JP_BOSS_NAMES  = ["Warlord","Demon General","Shadow Daimyo","Blood Oni","Iron Samurai","Thunder Lord"];
const CN_BOSS_NAMES  = ["Dragon General","Iron Warlord","Shadow Emperor","Thunder Khan","Fire Lord","Celestial Warrior"];

const SPECIAL_BOSSES = [
  { name: "Oda Nobunaga's Ghost",   skill: "Demon King's Wrath" },
  { name: "Toyotomi Hideyoshi",     skill: "Monkey King's Cunning" },
  { name: "Tokugawa Ieyasu",        skill: "Tanuki's Patience" },
  { name: "Uesugi Kenshin",         skill: "War God's Blessing" },
  { name: "Takeda Shingen",         skill: "Mountain Fortress" },
  { name: "Date Masamune",          skill: "One-Eyed Dragon" },
];

export const WEAPON_NAMES: Record<string, string[]> = {
  sword:      ["Katana","Nodachi","Wakizashi","Tachi","Odachi"],
  spear:      ["Yari","Naginata","Bisento","Jumonji Yari"],
  bow:        ["Yumi","Daikyu","Hankyu","War Bow"],
  staff:      ["Shakujo","Bo Staff","Mystic Rod","Spirit Wand"],
  dagger:     ["Tanto","Kunai","Shuriken Blade","Shadow Edge"],
  gun:        ["Tanegashima","Arquebuse","Fire Serpent"],
  instrument: ["War Drum","Battle Flute","Spirit Shamisen"],
  whip:       ["Iron Chain","Dragon Whip","Thunder Lash"],
};
export const ARMOR_NAMES  = ["Do Maru","Haramaki","Tosei Gusoku","Okegawa Do","Lamellar Armor","Scale Armor"];
export const SHIELD_NAMES = ["Tate","Round Shield","Iron Buckler","War Board"];
export const HELMET_NAMES = ["Kabuto","Jingasa","Iron Helm","Spirit Mask","Demon Kabuto"];
export const ACC_NAMES    = ["Magatama","War Fan","Prayer Beads","Jade Pendant","Spirit Talisman"];

export const RARITY_ORDER = ["white","green","blue","purple","orange","red","gold","exotic","transcendent","celestial"];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function equipRarityFromRandom(locationId = 1): string {
  const r = Math.random();
  if (locationId >= 100) {
    const b = (locationId - 100) * 0.02;
    if (r > 0.985 - b) return "celestial";
    if (r > 0.965 - b) return "transcendent";
    if (r > 0.92  - b) return "exotic";
    if (r > 0.85  - b) return "gold";
    if (r > 0.75  - b) return "red";
    if (r > 0.60  - b) return "orange";
    if (r > 0.40  - b) return "purple";
    if (r > 0.20  - b) return "blue";
    if (r > 0.10  - b) return "green";
    return "white";
  }
  const b = (locationId - 1) * 0.03;
  if (r > 0.995 - b / 5) return "celestial";
  if (r > 0.985 - b / 2) return "transcendent";
  if (r > 0.97  - b)     return "exotic";
  if (r > 0.95  - b)     return "gold";
  if (r > 0.90  - b)     return "red";
  if (r > 0.82  - b)     return "orange";
  if (r > 0.70  - b)     return "purple";
  if (r > 0.50  - b)     return "blue";
  if (r > 0.25  - b)     return "green";
  return "white";
}

export function generateEquipment(userId: string, locationId = 1, isBoss = false) {
  const rarity = equipRarityFromRandom(locationId);
  const types  = ["Weapon","Armor","Shield","HeadgearUpper","Accessory","Garment","Footgear"];
  const type   = isBoss ? pick(["Weapon","Armor"]) : pick(types);
  let name: string;
  if (type === "Weapon")           name = pick(WEAPON_NAMES[pick(Object.keys(WEAPON_NAMES))]);
  else if (type === "Armor")       name = pick(ARMOR_NAMES);
  else if (type === "Shield")      name = pick(SHIELD_NAMES);
  else if (type === "HeadgearUpper") name = pick(HELMET_NAMES);
  else                             name = pick(ACC_NAMES);
  const ri   = RARITY_ORDER.indexOf(rarity);
  const mult = 1 + ri * 0.5 + (locationId - 1) * 0.1;
  return {
    userId, name, type, rarity,
    attackBonus:  type === "Weapon" ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    defenseBonus: ["Armor","Shield","Garment","Footgear"].includes(type) ? Math.floor((5 + Math.random() * 10) * mult) : 0,
    speedBonus:   type === "Footgear" ? Math.floor((2 + Math.random() * 5) * mult) : 0,
    hpBonus:      type === "Armor"    ? Math.floor((10 + Math.random() * 20) * mult) : 0,
    level: 1, isEquipped: false,
    cardSlots: ri >= 5 ? 1 : 0,
  };
}

export function generateEnemyStats(
  type: "field" | "boss" | "special",
  _playerLevel: number,
  locationId = 1,
) {
  const targetLevel = locationId >= 100 ? 7 + (locationId - 101) : locationId;
  const locMult     = 1 + (targetLevel - 1) * 0.1;

  const baseStats = (lvl: number) => ({
    str: Math.floor(lvl * 1.5),
    agi: Math.floor(lvl * 1.2),
    vit: Math.floor(lvl * 1.3),
    int: Math.floor(lvl * 0.8),
    dex: Math.floor(lvl * 1.4),
    luk: Math.max(1, Math.floor(lvl * 0.5)),
  });

  if (type === "field") {
    const name  = locationId >= 100 ? pick(CN_ENEMY_NAMES) : pick(JP_ENEMY_NAMES);
    const lvl   = targetLevel;
    const stats = baseStats(lvl);
    const hDEF  = Math.floor((lvl * 8  + 15) * locMult);
    const wATK  = Math.floor((lvl * 10 + 20) * locMult);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 50 + 100) * locMult), maxHp: Math.floor((lvl * 50 + 100) * locMult),
      attack: wATK, defense: hDEF, speed: Math.floor((lvl * 5 + 10) * locMult),
      weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 1, hardDEF: hDEF, softDEF: 0,
      hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
      flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
      skills: ["Scratch","Bite"], statusEffects: [],
    };
  }

  if (type === "boss") {
    const name  = locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    const lvl   = targetLevel + 2;
    const stats = baseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.3);
    stats.agi = Math.floor(stats.agi * 1.2);
    const hDEF = Math.floor((lvl * 25 + 80)  * locMult);
    const wATK = Math.floor((lvl * 30 + 100) * locMult);
    return {
      name, level: lvl,
      hp: Math.floor((lvl * 200 + 1000) * locMult), maxHp: Math.floor((lvl * 200 + 1000) * locMult),
      attack: wATK, defense: hDEF, speed: Math.floor((lvl * 15 + 50) * locMult),
      weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 2, hardDEF: hDEF, softDEF: 0,
      hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
      flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
      skills: ["War Cry","Shield Wall","Charge","Strategic Strike"], statusEffects: [],
    };
  }

  // special
  const sb   = pick(SPECIAL_BOSSES);
  const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
  const lvl  = targetLevel + 5;
  const stats = baseStats(lvl);
  stats.vit = Math.floor(stats.vit * 1.6);
  stats.agi = Math.floor(stats.agi * 1.3);
  stats.dex = Math.floor(stats.dex * 1.2);
  const hDEF = Math.floor((lvl * 40 + 150) * locMult);
  const wATK = Math.floor((lvl * 50 + 200) * locMult);
  return {
    name, level: lvl,
    hp: Math.floor((lvl * 500 + 3000) * locMult), maxHp: Math.floor((lvl * 500 + 3000) * locMult),
    attack: wATK, defense: hDEF, speed: Math.floor((lvl * 30 + 100) * locMult),
    weaponType: "none", ...stats, weaponATK: wATK, weaponLevel: 3, hardDEF: hDEF, softDEF: 0,
    hit:  175 + lvl + stats.dex + Math.floor(stats.luk / 3),
    flee: 100 + lvl + stats.agi + Math.floor(stats.luk / 5) + Math.floor(stats.luk / 10),
    skills: [sb.skill,"Roar","Dark Aura","Divine Intervention"], statusEffects: [],
  };
}
