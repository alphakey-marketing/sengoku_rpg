import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { api, buildUrl } from "@shared/routes";
import { runTurnBasedCombat } from "./combat";

const EQUIP_TYPES = ['weapon', 'armor', 'accessory', 'horse_gear'];

const YOKAI_NAMES = ["Oni Brute", "Kappa Scout", "Tengu Warrior", "Kitsune Trickster", "Jorogumo"];
const JP_BOSS_NAMES = [
  "Daimyo Takeda Shingen", "Shogun Ashikaga Yoshiaki", "General Uesugi Kenshin", 
  "Lord Mori Motonari", "Toyotomi Hideyoshi", "Akechi Mitsuhide", 
  "Sanada Yukimura", "Date Masamune", "Hojo Ujiyasu", "Shimazu Yoshihiro"
];
const CN_BOSS_NAMES = [
  "General Lu Bu", "Imperial Sorcerer Zuo Ci", "Terracotta Commander", 
  "Guan Yu the God of War", "Prime Minister Cao Cao", "Emperor Sun Quan", 
  "Zhuge Liang the Strategist", "Empress Wu Zetian", "General Zhao Yun", "Zhang Fei the Fierce"
];
const BOSS_NAMES = JP_BOSS_NAMES;
const SPECIAL_BOSSES = [
  { name: "Nine-Tailed Fox (九尾の狐)", transformName: "Fox Spirit", skill: "Foxfire Barrage (狐火乱射)", atkPct: 40, defPct: 25, spdPct: 50, hpPct: 35 },
  { name: "Vengeful Warlord (怨霊武将)", transformName: "Oni Lord", skill: "Demon Summon (鬼神召喚)", atkPct: 50, defPct: 40, spdPct: 20, hpPct: 45 },
  { name: "Dragon King (龍王)", transformName: "Dragon Form", skill: "Tidal Wave (津波)", atkPct: 35, defPct: 50, spdPct: 30, hpPct: 50 },
];

const WEAPON_NAMES = ["Katana", "Yari Spear", "Naginata", "Nodachi", "Tanto"];
const ARMOR_NAMES = ["Do (胴)", "Kabuto (兜)", "Kusazuri (草摺)", "Suneate (臑当)"];

const CLASSIC_DROPS = {
  weapon: [
    { name: "Knife", atk: 17, reqLv: 1, slots: 4 },
    { name: "Cutter", atk: 28, reqLv: 1, slots: 4 },
    { name: "Main Gauche", atk: 43, reqLv: 1, slots: 4 },
    { name: "Sword", atk: 25, reqLv: 2, slots: 4 },
    { name: "Falchion", atk: 39, reqLv: 2, slots: 4 },
    { name: "Blade", atk: 53, reqLv: 2, slots: 4 },
    { name: "Bow", atk: 15, reqLv: 1, slots: 4 },
    { name: "Composite Bow", atk: 29, reqLv: 1, slots: 4 },
    { name: "Great Bow", atk: 43, reqLv: 10, slots: 4 },
    { name: "Rod", atk: 15, reqLv: 1, matk: 15, slots: 4 },
    { name: "Wand", atk: 34, reqLv: 1, matk: 15, int: 1, slots: 4 }
  ],
  armor: [
    { name: "Cotton Shirt", def: 1, reqLv: 1, slots: 1 },
    { name: "Jacket", def: 2, reqLv: 1, slots: 1 },
    { name: "Adventurer's Suit", def: 3, reqLv: 1, slots: 1 },
    { name: "Mantle", def: 4, reqLv: 1, slots: 1 },
    { name: "Coat", def: 5, reqLv: 14, slots: 1 },
    { name: "Padded Armor", def: 6, reqLv: 14, slots: 1 }
  ],
  shield: [
    { name: "Guard", def: 3, reqLv: 1, slots: 1 },
    { name: "Buckler", def: 4, reqLv: 14, slots: 1 }
  ],
  garment: [
    { name: "Hood", def: 1, reqLv: 1, slots: 1 },
    { name: "Muffler", def: 2, reqLv: 14, slots: 1 }
  ],
  footgear: [
    { name: "Sandals", def: 1, reqLv: 1, slots: 1 },
    { name: "Shoes", def: 2, reqLv: 14, slots: 1 }
  ],
  headgear: [
    { name: "Bandana", def: 1, reqLv: 1, slots: 0 },
    { name: "Cap", def: 3, reqLv: 14, slots: 0 },
    { name: "Ribbon", def: 1, reqLv: 1, int: 1, mdef: 3, slots: 0 },
    { name: "Sunglasses", def: 0, reqLv: 1, slots: 0 },
    { name: "Flu Mask", def: 0, reqLv: 1, slots: 0 }
  ],
  accessory: [
    { name: "Novice Armlet", hp: 10, reqLv: 1, slots: 0 },
    { name: "Clip", reqLv: 1, slots: 1 },
    { name: "Rosary", luk: 2, mdef: 5, reqLv: 20, slots: 1 },
    { name: "Ring", str: 2, reqLv: 20, slots: 1 },
    { name: "Brooch", agi: 2, reqLv: 20, slots: 1 }
  ]
};

function calcEquipExpToNext(level: number) {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

function generatePet(userId: string, locationId: number = 1) {
  const pInfo = pick(PET_NAMES);
  const r = Math.random();
  const isChina = locationId >= 100;
  const bonus = isChina ? (locationId - 100) * 0.05 + 0.1 : (locationId - 1) * 0.02;

  let rarity = 'white';
  if (r > 0.99 - bonus/2) rarity = 'primal';
  else if (r > 0.98 - bonus) rarity = 'celestial';
  else if (r > 0.97 - bonus) rarity = 'transcendent';
  else if (r > 0.96 - bonus) rarity = 'exotic';
  else if (r > 0.90 - bonus) rarity = 'mythic';
  else if (r > 0.75 - bonus) rarity = 'gold';
  else if (r > 0.55 - bonus) rarity = 'purple';
  else if (r > 0.35 - bonus) rarity = 'blue';
  else if (r > 0.15 - bonus) rarity = 'green';

  const statsByRarity: Record<string, { hp: number, atk: number, def: number, spd: number }> = {
    white: { hp: 30, atk: 5, def: 5, spd: 15 },
    green: { hp: 50, atk: 10, def: 10, spd: 25 },
    blue: { hp: 80, atk: 18, def: 15, spd: 35 },
    purple: { hp: 120, atk: 28, def: 25, spd: 50 },
    gold: { hp: 200, atk: 45, def: 40, spd: 75 },
    mythic: { hp: 350, atk: 75, def: 65, spd: 110 },
    exotic: { hp: 600, atk: 130, def: 110, spd: 160 },
    transcendent: { hp: 1000, atk: 220, def: 190, spd: 240 },
    celestial: { hp: 1800, atk: 400, def: 350, spd: 380 },
    primal: { hp: 3500, atk: 800, def: 700, spd: 600 }
  };

  const stats = statsByRarity[rarity] || statsByRarity.white;
  const variance = () => (0.9 + Math.random() * 0.2); // 0.9 to 1.1 multiplier
  
  // Location scaling for base stats
  const locMult = isChina ? 2 + (locationId - 100) * 0.5 : 1 + (locationId - 1) * 0.2;
  const hpValue = Math.floor(stats.hp * locMult * variance());

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
    attack: Math.floor(stats.atk * locMult * variance()),
    defense: Math.floor(stats.def * locMult * variance()),
    speed: Math.floor(stats.spd * locMult * variance()),
    skill: pInfo.skill,
    isActive: false,
  };
}

function generateEquipment(userId: string, locationId: number = 1, forceGood: boolean = false) {
  const categories = Object.keys(CLASSIC_DROPS);
  const category = pick(categories) as keyof typeof CLASSIC_DROPS;
  const itemDef = pick(CLASSIC_DROPS[category]);
  
  // Slotted version chance: 1% for normal, 10% for boss/good
  const isSlotted = Math.random() < (forceGood ? 0.1 : 0.01);
  const slots = isSlotted ? (itemDef.slots || 0) : 0;
  
  const baseAtk = (itemDef as any).atk || 0;
  const baseDef = (itemDef as any).def || 0;
  
  const locMult = 1 + (locationId - 1) * 0.1;

  let weaponType = null;
  if (category === 'weapon') {
    const lowerName = itemDef.name.toLowerCase();
    if (lowerName.includes('bow')) weaponType = 'bow';
    else if (lowerName.includes('rod') || lowerName.includes('staff') || lowerName.includes('wand')) weaponType = 'staff';
    else if (lowerName.includes('knife') || lowerName.includes('cutter') || lowerName.includes('gauche')) weaponType = 'dagger';
    else weaponType = 'sword';
  }

  return {
    userId,
    name: itemDef.name + (slots > 0 ? ` [${slots}]` : ""),
    type: (itemDef as any).type || category,
    weaponType,
    level: 1,
    experience: 0,
    expToNext: calcEquipExpToNext(1),
    attackBonus: Math.floor(baseAtk * locMult),
    defenseBonus: Math.floor(baseDef * locMult),
    speedBonus: 0,
    hpBonus: Math.floor(((itemDef as any).hp || 0) * locMult),
    mdefBonus: Math.floor(((itemDef as any).mdef || 0) * locMult),
    matkBonus: (itemDef as any).matk || 0,
    cardSlots: slots,
    isEquipped: false
  };
}

const ACCESSORY_NAMES = ["Ninja Kunai", "Omamori Charm", "Smoke Bomb", "Shuriken Set"];
const HORSE_GEAR_NAMES = ["War Saddle", "Iron Stirrups", "Battle Reins", "Armored Barding"];
const PET_NAMES = [
  { name: "Spirit Fox (妖狐)", skill: "Heal (回復)" },
  { name: "War Hawk (鷹)", skill: "Scout (偵察)" },
  { name: "Shadow Cat (影猫)", skill: "Poison (毒)" },
];
const HORSE_NAMES = ["Kiso Horse (木曽馬)", "Misaki Pony (御崎馬)", "Tokara Stallion (トカラ馬)"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const HORSE_RARITY_STATS: Record<string, { speed: number, atk: number, def: number }> = {
  white: { speed: 10, atk: 5, def: 5 },
  green: { speed: 20, atk: 15, def: 15 },
  blue: { speed: 35, atk: 30, def: 30 },
  purple: { speed: 60, atk: 50, def: 50 },
  gold: { speed: 100, atk: 85, def: 85 },
  mythic: { speed: 160, atk: 140, def: 140 },
  exotic: { speed: 240, atk: 210, def: 210 },
  transcendent: { speed: 340, atk: 300, def: 300 },
  celestial: { speed: 460, atk: 410, def: 410 },
  primal: { speed: 600, atk: 540, def: 540 }
};

function generateHorse(userId: string, locationId: number = 1) {
  const name = pick(HORSE_NAMES);
  const r = Math.random();
  const isChina = locationId >= 100;
  
  // Dynamic rarity scaling for horses based on location
  const bonus = isChina ? (locationId - 100) * 0.05 + 0.1 : (locationId - 1) * 0.02;
  
    let rarity = 'white';
    // Drops only up to 'purple' (LEGENDARY in UI)
    if (r > 0.95 - bonus) rarity = 'purple';
    else if (r > 0.80 - bonus) rarity = 'blue';
    else if (r > 0.55 - bonus) rarity = 'green';
    else rarity = 'white';

  const statsByRarity: Record<string, { speed: number, atk: number, def: number }> = {
    white: { speed: 10, atk: 5, def: 5 },
    green: { speed: 20, atk: 15, def: 15 },
    blue: { speed: 35, atk: 30, def: 30 },
    purple: { speed: 60, atk: 50, def: 50 },
    gold: { speed: 100, atk: 85, def: 85 },
    mythic: { speed: 160, atk: 140, def: 140 },
    exotic: { speed: 240, atk: 210, def: 210 },
    transcendent: { speed: 340, atk: 300, def: 300 },
    celestial: { speed: 460, atk: 410, def: 410 },
    primal: { speed: 600, atk: 540, def: 540 }
  };

  const stats = statsByRarity[rarity] || statsByRarity.white;
  const variance = () => (0.9 + Math.random() * 0.2); // 0.9 to 1.1 multiplier
  return {
    userId,
    name: `${rarity.toUpperCase()} ${name}`,
    rarity,
    level: 1,
    speedBonus: Math.floor(stats.speed * variance()),
    attackBonus: Math.floor(stats.atk * variance()),
    defenseBonus: Math.floor(stats.def * variance()),
    isActive: false
  };
}


function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.99) return "5";
  if (r > 0.90) return "4";
  if (r > 0.75) return "3";
  if (r > 0.50) return "2";
  return "1";
}

function equipRarityFromRandom(locationId: number = 1): string {
  const r = Math.random();
  const isChina = locationId >= 100;
  
  if (isChina) {
    const chinaIndex = locationId - 100;
    const bonus = chinaIndex * 0.02;
    if (r > 0.985 - bonus) return 'celestial';
    if (r > 0.965 - bonus) return 'transcendent';
    if (r > 0.92 - bonus) return 'exotic';
    if (r > 0.80 - bonus) return 'mythic';
    if (r > 0.60 - bonus) return 'gold';
    if (r > 0.40 - bonus) return 'purple';
    if (r > 0.20 - bonus) return 'blue';
    if (r > 0.10 - bonus) return 'green';
    return 'white';
  }

  const japanBonus = (locationId - 1) * 0.03;
  
  if (r > 0.995 - japanBonus/5) return 'celestial';     
  if (r > 0.985 - japanBonus/2) return 'transcendent';  
  if (r > 0.95 - japanBonus) return 'exotic';         
  if (r > 0.85 - japanBonus) return 'mythic';         
  if (r > 0.70 - japanBonus) return 'gold';           
  if (r > 0.50 - japanBonus) return 'purple';         
  if (r > 0.30 - japanBonus) return 'blue';           
  if (r > 0.15 - japanBonus) return 'green';          
  return 'white';                       
}

async function getPlayerTeamStats(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const comps = await storage.getCompanions(userId);
  const equips = await storage.getEquipment(userId);
  const allPets = await storage.getPets(userId);
  const allHorses = await storage.getHorses(userId);
  const allTransforms = await storage.getTransformations(userId);

  const partyCompanions = comps.filter(c => c.isInParty);
  const activePet = allPets.find(p => p.isActive);
  const activeHorse = allHorses.find(h => h.isActive);

    const playerEquipped = equips.filter(e => e.isEquipped && e.equippedToType === 'player');
    const weapon = playerEquipped.find(e => e.type === 'Weapon');
    const weaponType = (weapon as any)?.weaponType;
    
    let activeTransform = null;
    if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
      activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
    }

    const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
    const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
    const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
    const totalHpBonus = playerEquipped.reduce((s, e) => s + Math.floor((e.hpBonus || 0) * (1 + (e.level - 1) * 0.1)), 0);

    const STR = (user as any).str || 1;
    const AGI = (user as any).agi || 1;
    const VIT = (user as any).vit || 1;
    const INT = (user as any).int || 1;
    const DEX = (user as any).dex || 1;
    const LUK = (user as any).luk || 1;
    const BaseLv = user.level;

    const statusATK = STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    const statusMATK = Math.floor(1.5 * INT) + Math.floor(DEX / 5) + Math.floor(LUK / 3);
    const softDEF = Math.floor(VIT / 2) + Math.floor(AGI / 5);
    const softMDEF = INT + Math.floor(VIT / 5) + Math.floor(DEX / 5);
    const hit = 175 + BaseLv + DEX + Math.floor(LUK / 3);
    const fleeA = 100 + BaseLv + AGI + Math.floor(LUK / 5);
    const perfectDodge = Math.floor(LUK / 10);
    const flee = fleeA + perfectDodge;
    const critRate = 0.3 * LUK;

    const statusAtk = (weaponType === 'bow' || weaponType === 'gun' || weaponType === 'instrument' || weaponType === 'whip')
      ? Math.floor(BaseLv / 4) + Math.floor(STR / 5) + DEX + Math.floor(LUK / 3)
      : Math.floor(BaseLv / 4) + STR + Math.floor(DEX / 5) + Math.floor(LUK / 3);

    const baseWeaponAtk = totalAtkBonus + (user.permAttackBonus || 0);
    const finalWeaponAtk = (weaponType === 'bow' || weaponType === 'gun' || weaponType === 'instrument' || weaponType === 'whip')
      ? Math.floor(baseWeaponAtk * (1 + 0.005 * DEX))
      : Math.floor(baseWeaponAtk * (1 + 0.005 * STR));

  let attack = statusAtk + finalWeaponAtk;
    let defense = (user.defense || 0) + totalDefBonus + (user.permDefenseBonus || 0);
    let speed = (user.speed || 0) + totalSpdBonus + (user.permSpeedBonus || 0) + Math.floor(AGI / 2); 
    let maxHp = Math.floor(((user.maxHp || 100) + (user.permHpBonus || 0)) * (1 + 0.01 * VIT)) + totalHpBonus;
    let hp = Math.min((user.hp || 100) + (user.permHpBonus || 0) + totalHpBonus, maxHp);
    const maxSp = Math.floor(100 * (1 + 0.01 * INT)); 

    if (activeTransform) {
      attack = Math.floor(attack * (1 + activeTransform.attackPercent / 100));
      defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
      speed = Math.floor(speed * (1 + activeTransform.speedPercent / 100));
      const hpBonus = Math.floor(maxHp * (activeTransform.hpPercent / 100));
      maxHp += hpBonus;
      hp += hpBonus;
    }

    const stats = {
      player: {
        name: user.firstName || user.lastName || 'Warrior',
        level: user.level,
        hp,
        maxHp,
        attack,
        defense,
        speed,
        weaponType,
        str: STR,
        agi: AGI,
        vit: VIT,
        int: INT,
        dex: DEX,
        luk: LUK,
        strBonus: 0, 
        agiBonus: 0,
        vitBonus: 0,
        intBonus: 0,
        dexBonus: 0,
        lukBonus: 0,
        statPoints: user.statPoints || 0,
        hit,
        flee,
        statusMATK,
        softMDEF,
        maxSp,
        critChance: playerEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(critRate),
        critDamage: playerEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: playerEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        equipped: playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level })),
        canTransform: allTransforms.length > 0,
        activeTransform: activeTransform ? {
          name: activeTransform.name,
          until: user.transformActiveUntil
        } : null,
        seppukuCount: user.seppukuCount || 0,
        permStats: {
          attack: user.permAttackBonus || 0,
          defense: user.permDefenseBonus || 0,
          speed: user.permSpeedBonus || 0,
          hp: user.permHpBonus || 0,
        }
      } as any,
    companions: partyCompanions.map(c => {
      const compEquipped = equips.filter(e => e.isEquipped && e.equippedToType === 'companion' && Number(e.equippedToId) === Number(c.id));
      const cWeapon = compEquipped.find(e => e.type === 'Weapon');
      const cWeaponType = (cWeapon as any)?.weaponType;
      
      const cAtkBonus = compEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
      const cDefBonus = compEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
      const cSpdBonus = compEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
      
      const cSTR = (c as any).str || 10;
      const cVIT = (c as any).vit || 10;
      const cAGI = (c as any).agi || 10;
      const cDEX = (c as any).dex || 10;
      const cLUK = (c as any).luk || 1;
      const cLv = c.level || 1;

      const cStatusAtk = (cWeaponType === 'bow' || cWeaponType === 'gun' || cWeaponType === 'instrument' || cWeaponType === 'whip')
        ? Math.floor(cLv / 4) + Math.floor(cSTR / 5) + cDEX + Math.floor(cLUK / 3)
        : Math.floor(cLv / 4) + cSTR + Math.floor(cDEX / 5) + Math.floor(cLUK / 3);

      const cBaseWeaponAtk = cAtkBonus;
      const cFinalWeaponAtk = (cWeaponType === 'bow' || cWeaponType === 'gun' || cWeaponType === 'instrument' || cWeaponType === 'whip')
        ? Math.floor(cBaseWeaponAtk * (1 + 0.005 * cDEX))
        : Math.floor(cBaseWeaponAtk * (1 + 0.005 * cSTR));

      let cMaxHp = Math.floor(c.maxHp * (1 + 0.01 * cVIT));
      let cHp = Math.min(c.hp, cMaxHp);
      let cAttack = cStatusAtk + cFinalWeaponAtk;
      let cDefense = c.defense + cDefBonus;
      let cSpeed = c.speed + cSpdBonus;

      return {
        id: c.id,
        name: c.name,
        level: c.level,
        hp: cHp,
        maxHp: cMaxHp,
        attack: cAttack,
        defense: cDefense,
        speed: cSpeed,
        weaponType: cWeaponType,
        str: cSTR,
        agi: cAGI,
        vit: cVIT,
        int: (c as any).int || 10,
        dex: cDEX,
        luk: cLUK,
        critChance: compEquipped.reduce((s, e) => s + (e.critChance || 0), 0) + Math.floor(cLUK * 0.3),
        critDamage: compEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: compEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        skill: c.skill,
        equipped: compEquipped.map(e => ({ name: e.name, type: e.type, level: e.level })),
      } as any;
    }),
    pet: activePet ? {
      name: activePet.name,
      level: activePet.level,
      hp: activePet.hp,
      maxHp: activePet.maxHp,
      attack: activePet.attack,
      defense: activePet.defense,
      speed: activePet.speed,
      skill: activePet.skill,
    } : null,
    horse: activeHorse ? {
      name: activeHorse.name,
      level: activeHorse.level,
      speedBonus: activeHorse.speedBonus,
      attackBonus: activeHorse.attackBonus,
      defenseBonus: activeHorse.defenseBonus || 0,
      skill: activeHorse.skill,
    } : null,
  };

  if (activePet) {
    const party = [stats.player, ...stats.companions];
    party.forEach(member => {
      member.attack += activePet.attack;
      member.defense += activePet.defense;
      member.speed += activePet.speed;
      member.maxHp += activePet.hp;
      member.hp += activePet.hp;
    });
  }

  if (activeHorse) {
    const party = [stats.player, ...stats.companions];
    party.forEach(member => {
      if (activeHorse.speedBonus > 0) {
        member.speed = Math.floor(member.speed * (1 + activeHorse.speedBonus / 100));
      }
      if (activeHorse.attackBonus > 0) {
        member.attack = Math.floor(member.attack * (1 + activeHorse.attackBonus / 100));
      }
      if ((activeHorse.defenseBonus || 0) > 0) {
        member.defense = Math.floor(member.defense * (1 + (activeHorse.defenseBonus || 0) / 100));
      }
    });
  }

  return stats;
}

function generateEnemyStats(
  type: 'field' | 'boss' | 'special',
  playerLevel: number,
  locationId: number = 1
) {
  let targetLevel = 1;
  if (locationId >= 100) {
    targetLevel = 7 + (locationId - 101);
  } else {
    targetLevel = locationId;
  }

  const locationMultiplier = 1 + (targetLevel - 1) * 0.1;

  const makeBaseStats = (lvl: number) => {
    return {
      str: Math.floor(lvl * 1.5),
      agi: Math.floor(lvl * 1.2),
      vit: Math.floor(lvl * 1.3),
      int: Math.floor(lvl * 0.8),
      dex: Math.floor(lvl * 1.4),
      luk: Math.max(1, Math.floor(lvl * 0.5)),
    };
  };

  if (type === 'field') {
    const name =
      locationId >= 100
        ? pick(["Terracotta Guard", "Silk Road Bandit", "Mountain Cultivator"])
        : pick(YOKAI_NAMES);

    const lvl = targetLevel;
    const baseHp = lvl * 40 + 100;
    const baseAtk = lvl * 10 + 20;
    const baseDef = lvl * 6 + 15;
    const baseSpd = lvl * 5 + 10;

    const stats = makeBaseStats(lvl);
    const hardDEF = Math.floor(baseDef * locationMultiplier);
    const weaponATK = Math.floor(baseAtk * locationMultiplier);
    const weaponLevel = 1;
    const hit = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const perfectDodge = Math.floor(stats.luk / 10);
    const flee = fleeA + perfectDodge;

    return {
      name,
      level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK,
      defense: hardDEF,
      speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none',
      str: stats.str,
      agi: stats.agi,
      vit: stats.vit,
      int: stats.int,
      dex: stats.dex,
      luk: stats.luk,
      weaponATK,
      weaponLevel,
      hardDEF,
      softDEF: 0,
      hit,
      flee,
      skills: ["Scratch", "Bite"],
    };
  } else if (type === 'boss') {
    const name =
      locationId >= 100 ? pick(CN_BOSS_NAMES) : pick(JP_BOSS_NAMES);
    const lvl = targetLevel + 2;

    const baseHp = lvl * 200 + 1000;
    const baseAtk = lvl * 30 + 100;
    const baseDef = lvl * 25 + 80;
    const baseSpd = lvl * 15 + 50;

    const stats = makeBaseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.3);
    stats.agi = Math.floor(stats.agi * 1.2);

    const hardDEF = Math.floor(baseDef * locationMultiplier);
    const weaponATK = Math.floor(baseAtk * locationMultiplier);
    const weaponLevel = 2;
    const hit = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const perfectDodge = Math.floor(stats.luk / 10);
    const flee = fleeA + perfectDodge;

    return {
      name,
      level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK,
      defense: hardDEF,
      speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none',
      str: stats.str,
      agi: stats.agi,
      vit: stats.vit,
      int: stats.int,
      dex: stats.dex,
      luk: stats.luk,
      weaponATK,
      weaponLevel,
      hardDEF,
      softDEF: 0,
      hit,
      flee,
      skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    const name = locationId >= 100 ? "Celestial Dragon Emperor" : sb.name;
    const lvl = targetLevel + 5;

    const baseHp = lvl * 400 + 5000;
    const baseAtk = lvl * 60 + 300;
    const baseDef = lvl * 50 + 250;
    const baseSpd = lvl * 30 + 100;

    const stats = makeBaseStats(lvl);
    stats.vit = Math.floor(stats.vit * 1.6);
    stats.agi = Math.floor(stats.agi * 1.3);
    stats.dex = Math.floor(stats.dex * 1.2);

    const hardDEF = Math.floor(baseDef * locationMultiplier);
    const weaponATK = Math.floor(baseAtk * locationMultiplier);
    const weaponLevel = 3;
    const hit = 175 + lvl + stats.dex + Math.floor(stats.luk / 3);
    const fleeA = 100 + lvl + stats.agi + Math.floor(stats.luk / 5);
    const perfectDodge = Math.floor(stats.luk / 10);
    const flee = fleeA + perfectDodge;

    return {
      name,
      level: lvl,
      hp: Math.floor(baseHp * locationMultiplier),
      maxHp: Math.floor(baseHp * locationMultiplier),
      attack: weaponATK,
      defense: hardDEF,
      speed: Math.floor(baseSpd * locationMultiplier),
      weaponType: 'none',
      str: stats.str,
      agi: stats.agi,
      vit: stats.vit,
      int: stats.int,
      dex: stats.dex,
      luk: stats.luk,
      weaponATK,
      weaponLevel,
      hardDEF,
      softDEF: 0,
      hit,
      flee,
      skills: [sb.skill, "Roar", "Dark Aura", "Divine Intervention"],
    };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Player routes
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
  });

  app.get(api.player.fullStatus.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(401).json({ message: "Unauthorized" });
    res.json(teamStats);
  });

  // Companions
  app.get(api.companions.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getCompanions(userId));
  });

  app.post(api.companions.setParty.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { companionIds } = req.body;
    if (!Array.isArray(companionIds) || companionIds.length > 5) {
      return res.status(400).json({ message: "Max 5 companions in party" });
    }
    const allComps = await storage.getCompanions(userId);
    
    const selectedComps = allComps.filter(c => companionIds.includes(c.id));
    const names = selectedComps.map(c => c.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      return res.status(400).json({ message: "Cannot deploy the same warrior twice" });
    }

    for (const comp of allComps) {
      const shouldBeInParty = companionIds.includes(comp.id);
      if (comp.isInParty !== shouldBeInParty) {
        await storage.updateCompanion(comp.id, { isInParty: shouldBeInParty });
      }
    }
    res.json(await storage.getCompanions(userId));
  });

  app.post(api.stats.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const currentVal = (user as any)[stat] || 1;
    if (currentVal >= 99) return res.status(400).json({ message: "Stat already at maximum" });

    const cost = Math.floor((currentVal - 1) / 10) + 2;
    if ((user.statPoints || 0) < cost) {
      return res.status(400).json({ message: `Not enough stat points. Need ${cost}.` });
    }

    const updates: any = {
      statPoints: user.statPoints - cost,
      [stat]: currentVal + 1
    };

    const updatedUser = await storage.updateUser(userId, updates);
    res.json(updatedUser);
  });

  app.post(api.stats.bulkUpgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { upgrades } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let currentStatPoints = user.statPoints || 0;
    const updates: any = {};
    const stats = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

    for (const [stat, amount] of Object.entries(upgrades)) {
      if (!stats.includes(stat)) continue;
      let val = (user as any)[stat] || 1;
      for (let i = 0; i < (amount as number); i++) {
        if (val >= 99) break;
        const cost = Math.floor((val - 1) / 10) + 2;
        if (currentStatPoints < cost) {
          return res.status(400).json({ message: "Not enough stat points for all upgrades" });
        }
        currentStatPoints -= cost;
        val++;
      }
      updates[stat] = val;
    }

    updates.statPoints = currentStatPoints;
    const updatedUser = await storage.updateUser(userId, updates);
    res.json(updatedUser);
  });

  app.post("/api/companions/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const comps = await storage.getCompanions(userId);
    const target = comps.find(c => c.id === compId);
    if (!target) return res.status(404).json({ message: "Companion not found" });
    if (target.isInParty) return res.status(400).json({ message: "Cannot dismiss active party member" });

    const raritySouls: Record<string, number> = { "1": 5, "2": 10, "3": 25, "4": 50, "5": 125 };
    const soulsGained = raritySouls[target.rarity] || 5;

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { warriorSouls: (user.warriorSouls || 0) + soulsGained });
    await storage.deleteCompanion(compId);

    res.json({ soulsGained });
  });

  app.post("/api/companions/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if ((user.warriorSouls || 0) < 10) return res.status(400).json({ message: "Not enough Warrior Souls" });

    const allComps = await storage.getCompanions(userId);
    const comp = allComps.find(c => c.id === compId);
    if (!comp) return res.status(404).json({ message: "Companion not found" });

    await storage.updateUser(userId, { warriorSouls: user.warriorSouls - 10 });

    const expAmount = 50;
    let newExp = comp.experience + expAmount;
    let newLevel = comp.level;
    let newExpToNext = comp.expToNext;
    let hp = comp.hp;
    let maxHp = comp.maxHp;
    let atk = comp.attack;
    let def = comp.defense;
    let spd = comp.speed;

    const RARITY_GROWTH: Record<string, { hp: number, atk: number, def: number, spd: number }> = {
      "1": { hp: 1.05, atk: 1.02, def: 1.03, spd: 1.05 },
      "2": { hp: 1.08, atk: 1.04, def: 1.06, spd: 1.08 },
      "3": { hp: 1.12, atk: 1.06, def: 1.09, spd: 1.12 },
      "4": { hp: 1.15, atk: 1.08, def: 1.12, spd: 1.15 },
      "5": { hp: 1.25, atk: 1.12, def: 1.18, spd: 1.25 }
    };

    const growth = RARITY_GROWTH[comp.rarity] || RARITY_GROWTH["1"];
    const specialBonus = (comp as any).isSpecial ? 1.25 : 1.0;

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.floor(100 * Math.pow(1.3, newLevel - 1));
      maxHp = Math.floor(maxHp * growth.hp * specialBonus) + 10;
      hp = maxHp;
      atk = Math.floor(atk * growth.atk * specialBonus) + 3;
      def = Math.floor(def * growth.def * specialBonus) + 3;
      spd = Math.floor(spd * growth.spd * specialBonus) + 2;
    }

    const updated = await storage.updateCompanion(comp.id, {
      experience: newExp,
      level: newLevel,
      expToNext: newExpToNext,
      hp,
      maxHp,
      attack: atk,
      defense: def,
      speed: spd,
    });

    res.json(updated);
  });

  // Equipment
  app.get(api.equipment.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getEquipment(userId));
  });

  app.post(api.equipment.equip.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { equippedToId, equippedToType } = req.body;

    const equips = await storage.getEquipment(userId);
    const targetEquip = equips.find(e => e.id === equipId);
    if (!targetEquip) return res.status(404).json({ message: "Equipment not found" });

    const sameTypeEquipped = equips.find(e =>
      e.id !== equipId &&
      e.isEquipped &&
      e.type === targetEquip.type &&
      e.equippedToType === equippedToType &&
      (equippedToType === 'player' ? true : e.equippedToId === equippedToId)
    );
    if (sameTypeEquipped) {
      await storage.updateEquipment(sameTypeEquipped.id, { isEquipped: false, equippedToId: null, equippedToType: null });
    }

    const updated = await storage.updateEquipment(equipId, {
      isEquipped: true,
      equippedToId,
      equippedToType,
    });
    res.json(updated);
  });

  app.post(api.equipment.unequip.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const equips = await storage.getEquipment(userId);
    const targetEquip = equips.find(e => e.id === equipId);
    if (!targetEquip) return res.status(404).json({ message: "Equipment not found" });
    const updated = await storage.updateEquipment(equipId, { isEquipped: false, equippedToId: null, equippedToType: null });
    res.json(updated);
  });

  app.post(api.equipment.recycle.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const equips = await storage.getEquipment(userId);
    const targetEquip = equips.find(e => e.id === equipId);
    if (!targetEquip) return res.status(404).json({ message: "Equipment not found" });
    if (targetEquip.isEquipped) return res.status(400).json({ message: "Cannot recycle equipped item" });

    const stonesGained = 5;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + stonesGained });
    await storage.deleteEquipment(equipId);

    res.json({ stonesGained });
  });

  app.post("/api/equipment/recycle-rarity", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await storage.recycleEquipment(userId);
      res.json(result);
    } catch (error) {
      console.error("Recycle error:", error);
      res.status(500).json({ message: "Failed to recycle items" });
    }
  });

  app.post(api.equipment.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { amount = 1 } = req.body;
    const upgradeAmount = Math.max(1, Math.floor(Number(amount)));

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if ((user.upgradeStones || 0) < upgradeAmount) return res.status(400).json({ message: "Not enough upgrade stones" });

    const equips = await storage.getEquipment(userId);
    const eq = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });

    const MAX_LEVEL = 20;
    if (eq.level >= MAX_LEVEL) return res.status(400).json({ message: "Equipment already at max level" });

    await storage.updateUser(userId, { upgradeStones: user.upgradeStones - upgradeAmount });

    const expPerStone = 50;
    const totalExpGained = expPerStone * upgradeAmount;
    let newExp = eq.experience + totalExpGained;
    let newLevel = eq.level;
    let newExpToNext = eq.expToNext;
    let atkBonus = eq.attackBonus;
    let defBonus = eq.defenseBonus;
    let spdBonus = eq.speedBonus;

    const RARITY_GROWTH: Record<string, { atk: number, def: number, spd: number }> = {
      white: { atk: 1.02, def: 1.03, spd: 1.05 },
      green: { atk: 1.04, def: 1.06, spd: 1.08 },
      blue: { atk: 1.06, def: 1.09, spd: 1.12 },
      purple: { atk: 1.08, def: 1.12, spd: 1.15 },
      gold: { atk: 1.12, def: 1.18, spd: 1.25 },
      mythic: { atk: 1.16, def: 1.25, spd: 1.35 },
      exotic: { atk: 1.22, def: 1.35, spd: 1.50 },
      transcendent: { atk: 1.30, def: 1.50, spd: 1.75 },
      celestial: { atk: 1.45, def: 1.75, spd: 2.10 },
      primal: { atk: 1.75, def: 2.25, spd: 3.00 }
    };

    const growth = RARITY_GROWTH[eq.rarity] || RARITY_GROWTH.white;

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = calcEquipExpToNext(newLevel);
      atkBonus = Math.floor(atkBonus * growth.atk) + 1;
      defBonus = Math.floor(defBonus * growth.def) + 1;
      spdBonus = Math.floor(spdBonus * growth.spd) + 1;
    }

    const updated = await storage.updateEquipment(eq.id, {
      experience: newExp,
      level: newLevel,
      expToNext: newExpToNext,
      attackBonus: atkBonus,
      defenseBonus: defBonus,
      speedBonus: spdBonus,
    });

    res.json(updated);
  });

  // Pets
  app.get(api.pets.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getPets(userId));
  });

  app.post(api.pets.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId = Number(req.params.id);
    const allPets = await storage.getPets(userId);
    for (const p of allPets) {
      if (p.isActive && p.id !== petId) await storage.updatePet(p.id, { isActive: false });
    }
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    const updated = await storage.updatePet(petId, { isActive: true });
    res.json(updated);
  });

  app.post("/api/pets/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId = Number(req.params.id);
    const pets = await storage.getPets(userId);
    const targetPet = pets.find(p => p.id === petId);
    if (!targetPet) return res.status(404).json({ message: "Pet not found" });
    if (targetPet.isActive) return res.status(400).json({ message: "Cannot recycle active pet" });

    const rarityEssence: Record<string, number> = { 
      white: 5, green: 10, blue: 25, purple: 50, gold: 125,
      mythic: 250, exotic: 500, transcendent: 1000, celestial: 2500, primal: 5000
    };
    const essenceGained = rarityEssence[targetPet.rarity] || 5;

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { petEssence: (user.petEssence || 0) + essenceGained });
    await storage.deletePet(petId);

    res.json({ essenceGained });
  });

  app.post("/api/pets/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId = Number(req.params.id);
    const { amount = 1 } = req.body;
    const upgradeAmount = Math.max(1, Math.floor(Number(amount)));

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const totalCost = upgradeAmount;
    if ((user.petEssence || 0) < totalCost) return res.status(400).json({ message: "Not enough pet essence" });

    const allPets = await storage.getPets(userId);
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    await storage.updateUser(userId, { petEssence: user.petEssence - totalCost });

    const expPerEssence = 50;
    const totalExpGained = expPerEssence * upgradeAmount;
    let newExp = pet.experience + totalExpGained;
    let newLevel = pet.level;
    let newExpToNext = pet.expToNext;
    let hp = pet.hp;
    let maxHp = pet.maxHp;
    let atk = pet.attack;
    let def = pet.defense;
    let spd = pet.speed;

    const RARITY_GROWTH: Record<string, { hp: number, atk: number, def: number, spd: number }> = {
      white: { hp: 1.05, atk: 1.02, def: 1.03, spd: 1.05 },
      green: { hp: 1.08, atk: 1.04, def: 1.06, spd: 1.08 },
      blue: { hp: 1.12, atk: 1.06, def: 1.09, spd: 1.12 },
      purple: { hp: 1.15, atk: 1.08, def: 1.12, spd: 1.15 },
      gold: { hp: 1.25, atk: 1.12, def: 1.18, spd: 1.25 },
      mythic: { hp: 1.35, atk: 1.16, def: 1.25, spd: 1.35 },
      exotic: { hp: 1.50, atk: 1.22, def: 1.35, spd: 1.50 },
      transcendent: { hp: 1.75, atk: 1.30, def: 1.50, spd: 1.75 },
      celestial: { hp: 2.10, atk: 1.45, def: 1.75, spd: 2.10 },
      primal: { hp: 3.00, atk: 1.75, def: 2.25, spd: 3.00 }
    };

    const growth = RARITY_GROWTH[pet.rarity] || RARITY_GROWTH.white;

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.floor(100 * Math.pow(1.3, newLevel - 1));
      maxHp = Math.floor(maxHp * growth.hp) + 5;
      hp = maxHp;
      atk = Math.floor(atk * growth.atk) + 2;
      def = Math.floor(def * growth.def) + 2;
      spd = Math.floor(spd * growth.spd) + 3;
    }

    const updated = await storage.updatePet(pet.id, {
      experience: newExp,
      level: newLevel,
      expToNext: newExpToNext,
      hp,
      maxHp,
      attack: atk,
      defense: def,
      speed: spd,
    });

    res.json(updated);
  });

  // Horses
  app.get(api.horses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getHorses(userId));
  });

  app.post("/api/transformations/:id/use-stone", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const transformId = Number(req.params.id);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if ((user.transformationStones || 0) < 10) {
      return res.status(400).json({ message: "Not enough transformation stones (need 10)" });
    }

    const transforms = await storage.getTransformations(userId);
    const transform = transforms.find(t => t.id === transformId);
    if (!transform) return res.status(404).json({ message: "Transformation not found" });

    const activeUntil = new Date();
    activeUntil.setHours(activeUntil.getHours() + 1);

    await storage.updateUser(userId, {
      transformationStones: user.transformationStones - 10,
      activeTransformId: transformId,
      transformActiveUntil: activeUntil,
    });

    res.json({ message: "Transformation activated", activeUntil });
  });

  app.post(api.horses.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const horseId = Number(req.params.id);
    const allHorses = await storage.getHorses(userId);
    for (const h of allHorses) {
      if (h.isActive && h.id !== horseId) await storage.updateHorse(h.id, { isActive: false });
    }
    const horse = allHorses.find(h => h.id === horseId);
    if (!horse) return res.status(404).json({ message: "Horse not found" });
    const updated = await storage.updateHorse(horseId, { isActive: true });
    res.json(updated);
  });

  app.post(api.horses.recycle.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const horseId = Number(req.params.id);
    const horse = await storage.getHorse(horseId);
    if (!horse || horse.userId !== userId) {
      return res.status(404).json({ message: "Horse not found" });
    }
    if (horse.isActive) {
      return res.status(400).json({ message: "Cannot recycle active horse" });
    }

    const rarityValues: Record<string, number> = {
      white: 10, green: 25, blue: 50, purple: 100, gold: 250,
      mythic: 500, exotic: 1000, transcendent: 2000, celestial: 4000, primal: 8000
    };
    const goldGained = rarityValues[horse.rarity] || 10;
    
    await storage.deleteHorse(horseId);
    const user = await storage.getUser(userId);
    if (user) {
      await storage.updateUser(userId, { gold: user.gold + goldGained });
    }
    res.json({ goldGained });
  });

  app.post(api.horses.combine.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { horseIds } = req.body;
    
    if (!horseIds || horseIds.length !== 3) {
      return res.status(400).json({ message: "Must provide exactly 3 horses" });
    }

    const horses = await Promise.all(horseIds.map((id: number) => storage.getHorse(id)));
    
    if (horses.some(h => !h || h.userId !== userId)) {
      return res.status(400).json({ message: "Invalid horses" });
    }
    if (horses.some(h => h.isActive)) {
      return res.status(400).json({ message: "Cannot combine active horses" });
    }

    const baseRarity = horses[0].rarity;
    if (!horses.every(h => h.rarity === baseRarity)) {
      return res.status(400).json({ message: "All horses must be same rarity" });
    }

    const rarityOrder = ['white', 'green', 'blue', 'purple', 'gold', 'mythic', 'exotic', 'transcendent', 'celestial', 'primal'];
    const currentIndex = rarityOrder.indexOf(baseRarity);
    
    const upgraded = Math.random() < 0.5;
    const newRarityIndex = upgraded && currentIndex < rarityOrder.length - 1 ? currentIndex + 1 : currentIndex;
    const newRarity = rarityOrder[newRarityIndex];

    for (const id of horseIds) {
      await storage.deleteHorse(Number(id));
    }

    const newHorse = generateHorse(userId, 1);
    newHorse.rarity = newRarity;
    newHorse.name = `${newRarity.toUpperCase()} ${pick(HORSE_NAMES)}`;
    const stats = HORSE_RARITY_STATS[newRarity] || HORSE_RARITY_STATS.white;
    const variance = () => (0.9 + Math.random() * 0.2);
    newHorse.speedBonus = Math.floor(stats.speed * variance());
    newHorse.attackBonus = Math.floor(stats.atk * variance());
    newHorse.defenseBonus = Math.floor(stats.def * variance());
    
    const created = await storage.createHorse(newHorse);
    res.json({ success: true, newHorse: created, upgraded });
  });

  // Transformations
  app.get(api.transformations.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getTransformations(userId));
  });

  // Battles
  async function giveEquipmentExp(userId: string, expAmount: number) {
    const equips = await storage.getEquipment(userId);
    const equipped = equips.filter(e => e.isEquipped);
    for (const eq of equipped) {
      let newExp = eq.experience + expAmount;
      let newLevel = eq.level;
      let newExpToNext = eq.expToNext;
      let atkBonus = eq.attackBonus;
      let defBonus = eq.defenseBonus;
      let spdBonus = eq.speedBonus;

      const RARITY_GROWTH: Record<string, { atk: number, def: number, spd: number }> = {
        white: { atk: 1.02, def: 1.03, spd: 1.05 },
        green: { atk: 1.04, def: 1.06, spd: 1.08 },
        blue: { atk: 1.06, def: 1.09, spd: 1.12 },
        purple: { atk: 1.08, def: 1.12, spd: 1.15 },
        gold: { atk: 1.12, def: 1.18, spd: 1.25 },
        mythic: { atk: 1.16, def: 1.25, spd: 1.35 },
        exotic: { atk: 1.22, def: 1.35, spd: 1.50 },
        transcendent: { atk: 1.30, def: 1.50, spd: 1.75 },
        celestial: { atk: 1.45, def: 1.75, spd: 2.10 },
        primal: { atk: 1.75, def: 2.25, spd: 3.00 }
      };

      const growth = RARITY_GROWTH[eq.rarity] || RARITY_GROWTH.white;

      while (newExp >= newExpToNext) {
        newExp -= newExpToNext;
        newLevel++;
        newExpToNext = calcEquipExpToNext(newLevel);
        atkBonus = Math.floor(atkBonus * growth.atk) + 1;
        defBonus = Math.floor(defBonus * growth.def) + 1;
        spdBonus = Math.floor(spdBonus * growth.spd) + 1;
      }

      if (newLevel !== eq.level) {
        await storage.updateEquipment(eq.id, {
          experience: newExp,
          level: newLevel,
          expToNext: newExpToNext,
          attackBonus: atkBonus,
          defenseBonus: defBonus,
          speedBonus: spdBonus,
        });
      } else if (newExp !== eq.experience) {
        await storage.updateEquipment(eq.id, { experience: newExp });
      }
    }
  }

  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const locationId = Number(req.body.locationId) || 1;
    const repeatCount = Number(req.body.repeatCount) || 1;
    const count = Math.min(Math.max(1, repeatCount), 10);

    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    let totalExpGained = 0;
    let totalStatPointsGained = 0;
    let totalGoldGained = 0;
    const allEquipmentDropped = [];
    const allPetsDropped = [];
    const allHorsesDropped = [];
    const allLogs: string[] = [];
    let ninjaEncounter = null;
    let ninjaEncounteredInThisSkirmish = false;

    for (let i = 0; i < count; i++) {
      if (count > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);

      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        ninjaEncounteredInThisSkirmish = true;
        const ninjaNames = locationId >= 100 ? ["Zhuge Liang (Ghost)", "Lu Bu's Spirit", "Empress Wu Zetian"] : ["Hattori Hanzo", "Fuma Kotaro", "Ishikawa Goemon", "Mochizuki Chiyome"];
        const ninjaName = pick(ninjaNames);
        const isSuperStrong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        
        let targetLevel = 1;
        if (locationId >= 100) {
          targetLevel = 7 + (locationId - 100);
        } else {
          targetLevel = locationId;
        }

        const ninjaStats = {
          name: ninjaName,
          level: isSuperStrong ? targetLevel + 20 : targetLevel + 2,
          hp: isSuperStrong ? 5000 : 1000,
          maxHp: isSuperStrong ? 5000 : 1000,
          attack: isSuperStrong ? 500 : 100,
          defense: isSuperStrong ? 300 : 50,
          speed: isSuperStrong ? 200 : 40,
          skills: ["Shadow Strike", "Smoke Bomb", "Assassinate"],
          isNinja: true,
          goldDemanded: Math.floor(user.gold * 0.1)
        };
        
        ninjaEncounter = ninjaStats;
        allLogs.push(`A famous ninja, ${ninjaName}, blocks your path!`);
        break;
      }

      const enemy = generateEnemyStats('field', user.level, locationId);
      if (i === 0 && req.body.enemyName) {
        enemy.name = req.body.enemyName;
      }
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      const victory = battleResult.victory;
      allLogs.push(...battleResult.logs);

      if (victory) {
        await storage.updateQuestProgress(userId, 'daily_skirmish', 1);
        await storage.updateQuestProgress(userId, 'daily_skirmish_elite', 1);
        const expGained = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const goldGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExpGained += expGained;
        totalGoldGained += goldGained;
        
        let currentExp = user.experience + totalExpGained;
        let currentLevel = user.level;
        let currentMaxHp = user.maxHp;
        let currentAtk = user.attack;
        let currentDef = user.defense;
        let currentSpd = user.speed;
        let currentStatPoints = user.statPoints || 0;

        while (currentExp >= Math.floor(100 * Math.pow(1.25, currentLevel - 1))) {
          currentExp -= Math.floor(100 * Math.pow(1.25, currentLevel - 1));
          currentStatPoints += Math.floor(currentLevel / 5) + 3;
          currentLevel++;
          currentMaxHp += 20;
          currentAtk += 5;
          currentDef += 3;
          currentSpd += 2;
        }
        
        const endowmentStoneGained = Math.random() < 0.2 ? 1 : 0;
        const talismanGained = Math.random() < 0.05 ? 1 : 0;

        const userUpdate: any = {
          level: currentLevel,
          experience: currentExp,
          gold: user.gold + totalGoldGained,
          maxHp: currentMaxHp,
          hp: currentMaxHp,
          attack: currentAtk,
          defense: currentDef,
          speed: currentSpd,
          statPoints: currentStatPoints,
          endowmentStones: (user.endowmentStones || 0) + endowmentStoneGained,
          fireGodTalisman: (user.fireGodTalisman || 0) + talismanGained
        };

        await storage.updateUser(userId, userUpdate);

        if (Math.random() < 0.01) {
          const eqData = generateEquipment(userId, locationId);
          try {
            const eq = await storage.createEquipment(eqData);
            allEquipmentDropped.push(eq);
            allLogs.push(`Found ${eq.rarity.toUpperCase()} ${eq.name}!`);
          } catch (err) {
            console.error("Failed to create equipment drop:", err);
          }
        }
      }
    }

    await giveEquipmentExp(userId, totalExpGained);

    res.json({
      victory: totalExpGained > 0,
      experienceGained: totalExpGained,
      goldGained: totalGoldGained,
      equipmentDropped: allEquipmentDropped,
      petDropped: allPetsDropped[0] || null,
      allPetsDropped,
      horseDropped: allHorsesDropped[0] || null,
      allHorsesDropped,
      logs: allLogs,
      ninjaEncounter
    });
  });

  app.post("/api/battle/ninja/resolve", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { action, ninjaName, goldDemanded, locationId = 1 } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (action === 'pay') {
      const goldToPay = Math.floor(Number(goldDemanded));
      const userStatus = await storage.getUser(userId);
      if (!userStatus) return res.status(401).json({ message: "Unauthorized" });
      
      const currentGold = Number(userStatus.gold) || 0;
      if (currentGold < goldToPay) {
        return res.status(400).json({ message: `Not enough gold. You have ${currentGold}, but ${goldToPay} is required.` });
      }
      
      await storage.updateUser(userId, { gold: currentGold - goldToPay });
      return res.json({ success: true, message: `You paid ${goldToPay} gold to ${ninjaName}. He vanished into the shadows.` });
    } else {
      const teamStats = await getPlayerTeamStats(userId);
      if (!teamStats) return res.status(400).json({ message: "Team not found" });

      let targetLevel = 1;
      if (locationId >= 100) {
        targetLevel = 7 + (locationId - 100);
      } else {
        targetLevel = locationId;
      }

      const isSuperStrong = Math.random() < 0.3;
      const enemy = {
        name: ninjaName,
        level: isSuperStrong ? targetLevel + 20 : targetLevel + 2,
        hp: isSuperStrong ? 5000 : 1000,
        maxHp: isSuperStrong ? 5000 : 1000,
        attack: isSuperStrong ? 500 : 100,
        defense: isSuperStrong ? 300 : 50,
        speed: isSuperStrong ? 200 : 40,
        skills: ["Shadow Strike", "Smoke Bomb", "Assassinate"],
      };

      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      if (battleResult.victory) {
        const goldGained = goldDemanded * 2;
        const stonesGained = 3 + Math.floor(Math.random() * 3);
        await storage.updateUser(userId, { 
          gold: user.gold + goldGained,
          endowmentStones: (user.endowmentStones || 0) + stonesGained
        });
        battleResult.logs.push(`You defeated ${ninjaName} and looted ${goldGained} gold and ${stonesGained} Endowment Stones!`);
      }
      res.json({ success: true, battleResult });
    }
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats = await getPlayerTeamStats(userId);
    const enemyData = generateEnemyStats('boss', user.level, locationId);
    if (req.body.enemyName) {
      enemyData.name = req.body.enemyName;
    }
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemyData]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      await storage.updateQuestProgress(userId, 'daily_boss', 1);
      const expGained = 100 + (locationId * 50);
      const goldGained = 50 + (locationId * 25);
      const riceGained = 10 + (locationId * 5);
      const endowmentStones = 2 + Math.floor(Math.random() * 3);

      let currentExp = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentAtk = user.attack;
      let currentDef = user.defense;
      let currentSpd = user.speed;
      let currentStatPoints = user.statPoints || 0;

      while (currentExp >= Math.floor(100 * Math.pow(1.25, currentLevel - 1))) {
        currentExp -= Math.floor(100 * Math.pow(1.25, currentLevel - 1));
        currentStatPoints += Math.floor(currentLevel / 5) + 3;
        currentLevel++;
        currentMaxHp += 20;
        currentAtk += 5;
        currentDef += 3;
        currentSpd += 2;
      }

      await storage.updateUser(userId, { 
        level: currentLevel,
        experience: currentExp, 
        gold: user.gold + goldGained, 
        rice: user.rice + riceGained,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
        maxHp: currentMaxHp,
        hp: currentMaxHp,
        attack: currentAtk,
        defense: currentDef,
        speed: currentSpd,
        statPoints: currentStatPoints
      });
      
      if (Math.random() < 0.05) {
        const eqData = generateEquipment(userId, locationId, true);
        const eq = await storage.createEquipment(eqData);
        res.json({ 
          victory: true, 
          experienceGained: expGained, 
          goldGained: goldGained, 
          riceGained: riceGained, 
          equipmentDropped: [eq],
          petDropped: null,
          logs 
        });
      } else {
        res.json({ 
          victory: true, 
          experienceGained: expGained, 
          goldGained: goldGained, 
          riceGained: riceGained, 
          equipmentDropped: [],
          petDropped: null,
          logs 
        });
      }
    } else {
      logs.push("Defeat!");
      res.json({ victory: false, logs });
    }
  });

  app.post(api.battle.specialBoss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats = await getPlayerTeamStats(userId);
    const enemyData = generateEnemyStats('special', user.level, locationId);
    if (req.body.enemyName) {
      enemyData.name = req.body.enemyName;
    }
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemyData]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      const expGained = 250 + (locationId * 100);
      const goldGained = 150 + (locationId * 75);
      const endowmentStones = 5 + Math.floor(Math.random() * 6);

      let currentExp = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentAtk = user.attack;
      let currentDef = user.defense;
      let currentSpd = user.speed;
      let currentStatPoints = user.statPoints || 0;

      while (currentExp >= Math.floor(100 * Math.pow(1.25, currentLevel - 1))) {
        currentExp -= Math.floor(100 * Math.pow(1.25, currentLevel - 1));
        currentStatPoints += Math.floor(currentLevel / 5) + 3;
        currentLevel++;
        currentMaxHp += 20;
        currentAtk += 5;
        currentDef += 3;
        currentSpd += 2;
      }
      
      await storage.updateUser(userId, { 
        level: currentLevel,
        experience: currentExp, 
        gold: user.gold + goldGained,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
        transformationStones: (user.transformationStones || 0) + 10,
        maxHp: currentMaxHp,
        hp: currentMaxHp,
        attack: currentAtk,
        defense: currentDef,
        speed: currentSpd,
        statPoints: currentStatPoints
      });

      const sb = pick(SPECIAL_BOSSES);
      const trans = await storage.createTransformation({
        userId,
        name: sb.transformName,
        level: 1,
        experience: 0,
        expToNext: 200,
        attackPercent: sb.atkPct,
        defensePercent: sb.defPct,
        speedPercent: sb.spdPct,
        hpPercent: sb.hpPct,
        skill: sb.skill,
        cooldownSeconds: 60,
        durationSeconds: 30,
      });
      res.json({ victory: true, transformationDropped: trans, logs, experienceGained: expGained, goldGained: goldGained });
    } else {
      logs.push("Defeat!");
      res.json({ victory: false, logs });
    }
  });

  // Campaign Events
  app.get(api.campaign.events.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getCampaignEvents(userId));
  });

  app.post(api.campaign.triggerEvent.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { eventKey, choice } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const logs: string[] = [];
    let reward: any = null;

    if (eventKey === 'onin_war') {
      if (choice === 'nobunaga') {
        logs.push("You supported the Oda clan in Owari.");
        await storage.updateUser(userId, { gold: user.gold + 500 });
        reward = { type: 'gold', amount: 500 };
      } else {
        logs.push("You chose to walk your own path.");
      }
    } else if (eventKey === 'honnoji') {
        if (choice === 'rescue') {
            logs.push("You fought through the fire to save the Lord.");
            await storage.updateUser(userId, { attack: user.attack + 10 });
            reward = { type: 'stat', stat: 'attack', amount: 10 };
        } else {
            logs.push("You joined the rebellion. The course of history changes.");
        }
    } else if (eventKey === 'yokai_random') {
        if (choice === 'ally') {
            logs.push("You formed an alliance with the fox spirit.");
            reward = await storage.createPet({
                userId,
                name: "Heavenly Fox",
                type: "yokai",
                rarity: "gold",
                level: 1,
                experience: 0,
                expToNext: 100,
                hp: 50,
                maxHp: 50,
                attack: 15,
                defense: 10,
                speed: 25,
                skill: "Foxfire Ward",
                isActive: false
            });
        } else {
            logs.push("The spirit vanishes into the mist.");
        }
    }

    const event = await storage.createCampaignEvent({
      userId,
      eventKey,
      choice,
      isTriggered: true,
      completedAt: new Date(),
    });

    res.json({ event, logs, reward });
  });

  // Gacha
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const isSpecial = req.body?.isSpecial || false;
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const singleCost = isSpecial ? 50 : 10;
    const totalCost = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    const warriorPool = [
      { name: "Oda Nobunaga", skill: "Demon King's Command", type: "General" },
      { name: "Toyotomi Hideyoshi", skill: "Ape's Cunning", type: "Strategist" },
      { name: "Tokugawa Ieyasu", skill: "Patient Turtle", type: "Defender" },
      { name: "Hattori Hanzo", skill: "Shadow Strike", type: "Ninja" },
      { name: "Sanada Yukimura", skill: "Crimson Charge", type: "Lancer" },
      { name: "Date Masamune", skill: "One-Eyed Dragon", type: "Ronin" },
      { name: "Uesugi Kenshin", skill: "God of War", type: "Monk" },
      { name: "Takeda Shingen", skill: "Furin-kazan", type: "General" },
      { name: "Miyamoto Musashi", skill: "Niten Ichi-ryu", type: "Samurai" },
      { name: "Sasaki Kojiro", skill: "Swallow Cut", type: "Samurai" },
      { name: "Honda Tadakatsu", skill: "Unscathed General", type: "Defender" },
      { name: "Akechi Mitsuhide", skill: "Tenka Fubu", type: "Tactician" }
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const warrior = pick(warriorPool);
      
      const rarityFromSpecial = () => {
        const r = Math.random();
        if (r > 0.85) return "5";
        if (r > 0.60) return "4";
        if (r > 0.30) return "3";
        return "2";
      };

      const rarity = isSpecial ? rarityFromSpecial() : rarityFromRandom();

      const baseStats = {
        "1": { hp: 60, atk: 12, def: 10, spd: 10 },
        "2": { hp: 80, atk: 15, def: 12, spd: 12 },
        "3": { hp: 100, atk: 20, def: 15, spd: 15 },
        "4": { hp: 130, atk: 28, def: 22, spd: 20 },
        "5": { hp: 180, atk: 40, def: 35, spd: 30 }
      }[rarity] || { hp: 60, atk: 12, def: 10, spd: 10 };

      const growthBonus = isSpecial ? 1.25 : 1.0;

      const companion = await storage.createCompanion({
        userId,
        name: warrior.name,
        type: warrior.type,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        hp: Math.floor(baseStats.hp * growthBonus),
        maxHp: Math.floor(baseStats.hp * growthBonus),
        attack: Math.floor(baseStats.atk * growthBonus),
        defense: Math.floor(baseStats.def * growthBonus),
        speed: Math.floor(baseStats.spd * growthBonus),
        skill: warrior.skill,
        isInParty: false,
        isSpecial: !!isSpecial,
      });
      results.push(companion);
    }
    
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ companions: results });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const singleCost = 15;
    const totalCost = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, { rice: user.rice - totalCost });
    
    const weaponNames = [
      "Masamune Katana", "Muramasa Blade", "Dragon Naginata", "Shadow Tanto", "Imperial Yari",
      "Honjo Masamune", "Kusanagi-no-Tsurugi", "Onimaru", "Mikazuki Munechika", "Tombstone Cutter",
      "Nihongo Spear", "Otegine", "Heshikiri Hasebe", "Azai Ichimonji", "Dragon Slaying Odachi"
    ];
    const armorNames = [
      "Oda Clan Do", "Red Thread Kabuto", "Shinobi Shozoku", "Iron Suneate", "Golden Menpo",
      "Nanban-do Armor", "Yukimura's Crimson Kabuto", "Date's Crescent Helm", "Dragon Scale Do",
      "Golden Lacquer Hara-ate", "Iron Menpo of Terror", "Shogun's Great Armor", "Shadow Stalker Garb"
    ];
    const accessoryNames = [
      "Magatama of Luck", "War Fan of Strategy", "Ninja Kunai Set", "Omamori of Health", "Smoke Bomb Belt",
      "Scroll of Hidden Mist", "Sacred Mirror", "Talisman of Elements", "Vengeful Spirit Mask",
      "Heirloom Inro", "Dragon Bone Rosary", "Jade Amulet", "Phoenix Feather"
    ];
    const horseGearNames = [
      "War Saddle", "Iron Stirrups", "Silk Reins", "Steel Barding", "Speed Spurs",
      "Imperial Gold Saddle", "Jade-Inlaid Stirrups", "Wind-Step Horseshoes", "Ceremonial Crest",
      "Takeda War Banner", "Thunder-Hoof Spurs", "Celestial Bridle", "Ebony Stirrups"
    ];

    const results = [];
    for (let i = 0; i < count; i++) {
      const rDrop = Math.random();
      let type: string;
      if (rDrop < 0.1) {
        type = 'accessory';
      } else {
        const others = ['weapon', 'armor', 'horse_gear'];
        type = others[Math.floor(Math.random() * others.length)];
      }
      
      const r = Math.random();
      let rarity = 'gold';
      if (r > 0.94) rarity = 'celestial';
      else if (r > 0.88) rarity = 'transcendent';
      else if (r > 0.78) rarity = 'exotic';
      else if (r > 0.60) rarity = 'mythic';
      else rarity = 'gold';

      const name = pick(
        type === 'weapon' ? weaponNames : 
        type === 'armor' ? armorNames : 
        type === 'accessory' ? accessoryNames : 
        horseGearNames
      );

      const statsByRarity: Record<string, { atk: number, def: number, spd: number }> = {
        gold: { atk: 35, def: 25, spd: 15 },
        mythic: { atk: 60, def: 45, spd: 25 },
        exotic: { atk: 100, def: 75, spd: 45 },
        transcendent: { atk: 200, def: 150, spd: 80 },
        celestial: { atk: 450, def: 350, spd: 150 }
      };
      const baseStats = statsByRarity[rarity] || statsByRarity.gold;
      
      let atkBonus = type === 'weapon' || type === 'accessory' ? baseStats.atk : 0;
      let defBonus = type === 'armor' || type === 'accessory' ? baseStats.def : 0;
      let spdBonus = type === 'horse_gear' || type === 'accessory' ? baseStats.spd : 0;

      let weaponType = null;
      if (type === 'weapon') {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('bow')) weaponType = 'bow';
        else if (lowerName.includes('rod') || lowerName.includes('staff') || lowerName.includes('wand')) weaponType = 'staff';
        else if (lowerName.includes('knife') || lowerName.includes('cutter') || lowerName.includes('gauche')) weaponType = 'dagger';
        else weaponType = 'sword';
      }

      const equipment = await storage.createEquipment({
        userId,
        name,
        type,
        weaponType,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: atkBonus,
        defenseBonus: defBonus,
        speedBonus: spdBonus,
      });
      results.push(equipment);
    }
    
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ equipment: results });
  });

  app.post("/api/player/exchange-stones", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const riceCost = 2000;
    if (user.rice < riceCost) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, {
      rice: user.rice - riceCost,
      endowmentStones: (user.endowmentStones || 0) + 1
    });
    
    res.json({ success: true });
  });

  app.post("/api/equipment/:id/endow", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { type, protect } = req.body;
    
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const equips = await storage.getEquipment(userId);
    const eq = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });

    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });

    const currentPoints = eq.endowmentPoints || 0;
    const baseRate = type === 'extreme' ? 0.7 : 0.9;
    const successRate = Math.max(0.1, baseRate - (currentPoints * 0.02));
    const roll = Math.random();
    
    let pointsGained = 0;
    let failed = false;

    if (roll < successRate) {
      if (type === 'advanced') {
        const advRoll = Math.random();
        if (advRoll < 0.1) pointsGained = 5;
        else if (advRoll < 0.25) pointsGained = 4;
        else if (advRoll < 0.45) pointsGained = 3;
        else if (advRoll < 0.70) pointsGained = 2;
        else pointsGained = 1;
      } else {
        pointsGained = 1;
      }
    } else {
      failed = true;
      const talismanField = type === 'extreme' ? 'flameEmperorTalisman' : 'fireGodTalisman';
      const hasTalisman = user[talismanField as keyof typeof user] as number > 0;
      
      if (protect && hasTalisman) {
        pointsGained = 0;
        await storage.updateUser(userId, { [talismanField]: (user[talismanField as keyof typeof user] as number) - 1 });
      } else {
        pointsGained = -Math.floor(Math.random() * 5) - 1;
      }
    }

    const newPoints = Math.max(0, Math.min(70, currentPoints + pointsGained));
    
    await storage.updateUser(userId, { endowmentStones: user.endowmentStones - 1 });
    const updated = await storage.updateEquipment(eq.id, { endowmentPoints: newPoints });

    res.json({ 
      success: !failed, 
      pointsGained, 
      newPoints,
      equipment: updated
    });
  });

  app.post("/api/restart", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    
    await storage.createEquipment({
      userId,
      name: "Training Sword",
      type: "weapon",
      weaponType: "sword",
      rarity: "white",
      level: 1,
      experience: 0,
      expToNext: 100,
      attackBonus: 5,
      defenseBonus: 0,
      speedBonus: 0,
      hpBonus: 0,
      mdefBonus: 0,
      fleeBonus: 0,
      matkBonus: 0,
      critChance: 5,
      critDamage: 0,
      endowmentPoints: 0,
      isEquipped: true,
      equippedToId: null,
      equippedToType: "player",
      cardSlots: 1
    } as any);

    res.json({ success: true });
  });

  app.get('/api/quests', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const quests = await storage.getQuests(userId);
    const QUEST_DEFS_POOL: Record<string, { name: string, desc: string, goal: number, reward: string }> = {
      'daily_skirmish': { name: 'Daily Skirmisher', desc: 'Win 5 skirmishes', goal: 5, reward: '50 Rice' },
      'daily_boss': { name: 'Giant Slayer', desc: 'Defeat a boss', goal: 1, reward: '30 Rice' },
      'daily_gacha': { name: 'Summoner', desc: 'Perform 3 summons', goal: 3, reward: '40 Rice' },
      'daily_skirmish_elite': { name: 'Elite Skirmisher', desc: 'Win 10 skirmishes', goal: 10, reward: '100 Rice' },
      'daily_gacha_elite': { name: 'Elite Summoner', desc: 'Perform 5 summons', goal: 5, reward: '80 Rice' }
    };
    
    const status = quests.map(q => {
      const def = QUEST_DEFS_POOL[q.questKey] || { name: 'Unknown Quest', desc: 'Unknown', goal: 1, reward: 'Unknown' };
      return {
        ...def,
        key: q.questKey,
        progress: q.progress,
        isClaimed: q.isClaimed
      };
    });
    
    res.json(status);
  });

  app.post('/api/quests/:key/claim', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const result = await storage.claimQuest(userId, req.params.key);
    res.json(result);
  });

  return httpServer;
}
