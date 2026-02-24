import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api, buildUrl } from "@shared/routes";
import { runTurnBasedCombat } from "./combat";

const EQUIP_TYPES = ['weapon', 'armor', 'accessory', 'horse_gear'];

const YOKAI_NAMES = ["Oni Brute", "Kappa Scout", "Tengu Warrior", "Kitsune Trickster", "Jorogumo"];
const BOSS_NAMES = ["Daimyo Takeda", "Shogun Ashikaga", "General Uesugi", "Lord Mori"];
const SPECIAL_BOSSES = [
  { name: "Nine-Tailed Fox (九尾の狐)", transformName: "Fox Spirit", skill: "Foxfire Barrage (狐火乱射)", atkPct: 40, defPct: 25, spdPct: 50, hpPct: 35 },
  { name: "Vengeful Warlord (怨霊武将)", transformName: "Oni Lord", skill: "Demon Summon (鬼神召喚)", atkPct: 50, defPct: 40, spdPct: 20, hpPct: 45 },
  { name: "Dragon King (龍王)", transformName: "Dragon Form", skill: "Tidal Wave (津波)", atkPct: 35, defPct: 50, spdPct: 30, hpPct: 50 },
];

const WEAPON_NAMES = ["Katana", "Yari Spear", "Naginata", "Nodachi", "Tanto"];
const ARMOR_NAMES = ["Do (胴)", "Kabuto (兜)", "Kusazuri (草摺)", "Suneate (臑当)"];
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
  white: { speed: 5, atk: 2, def: 2 },
  green: { speed: 10, atk: 5, def: 5 },
  blue: { speed: 15, atk: 8, def: 8 },
  purple: { speed: 20, atk: 12, def: 12 },
  gold: { speed: 30, atk: 20, def: 20 },
  mythic: { speed: 45, atk: 30, def: 30 },
  exotic: { speed: 65, atk: 45, def: 45 },
  transcendent: { speed: 90, atk: 65, def: 65 },
  celestial: { speed: 120, atk: 90, def: 90 },
  primal: { speed: 160, atk: 125, def: 125 }
};

function generateHorse(userId: string) {
  const name = pick(HORSE_NAMES);
  const r = Math.random();
  let rarity = 'white';
  if (r > 0.999) rarity = 'primal';
  else if (r > 0.995) rarity = 'celestial';
  else if (r > 0.985) rarity = 'transcendent';
  else if (r > 0.96) rarity = 'exotic';
  else if (r > 0.90) rarity = 'mythic';
  else if (r > 0.75) rarity = 'gold';
  else if (r > 0.55) rarity = 'purple';
  else if (r > 0.35) rarity = 'blue';
  else if (r > 0.15) rarity = 'green';

  const stats = HORSE_RARITY_STATS[rarity];
  return {
    userId,
    name: `${rarity.toUpperCase()} ${name}`,
    rarity,
    level: 1,
    speedBonus: stats.speed,
    attackBonus: stats.atk,
    defenseBonus: stats.def,
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

function equipRarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.999) return 'primal';        // 0.1%
  if (r > 0.995) return 'celestial';     // 0.4%
  if (r > 0.985) return 'transcendent';  // 1.0%
  if (r > 0.95) return 'exotic';         // 3.5%
  if (r > 0.85) return 'mythic';         // 10%
  if (r > 0.70) return 'gold';           // 15%
  if (r > 0.50) return 'purple';         // 20%
  if (r > 0.30) return 'blue';           // 20%
  if (r > 0.15) return 'green';          // 15%
  return 'white';                       // 15%
}

function calcEquipExpToNext(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
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
    
    let activeTransform = null;
    if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
      activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
    }

    const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
    const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
    const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);

    let hp = user.hp + (user.permHpBonus || 0);
    let maxHp = user.maxHp + (user.permHpBonus || 0);
    let attack = user.attack + totalAtkBonus + (user.permAttackBonus || 0);
    let defense = user.defense + totalDefBonus + (user.permDefenseBonus || 0);
    let speed = user.speed + totalSpdBonus + (user.permSpeedBonus || 0);

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
        critChance: playerEquipped.reduce((s, e) => s + (e.critChance || 0), 0),
        critDamage: playerEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: playerEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        equipped: playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
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
      const cAtkBonus = compEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
      const cDefBonus = compEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
      const cSpdBonus = compEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
      return {
        id: c.id,
        name: c.name,
        level: c.level,
        hp: c.hp,
        maxHp: c.maxHp,
        attack: c.attack + cAtkBonus,
        defense: c.defense + cDefBonus,
        speed: c.speed + cSpdBonus,
        critChance: compEquipped.reduce((s, e) => s + (e.critChance || 0), 0),
        critDamage: compEquipped.reduce((s, e) => s + (e.critDamage || 0), 0),
        endowmentPoints: compEquipped.reduce((s, e) => s + (e.endowmentPoints || 0), 0),
        skill: c.skill,
        equipped: compEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
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

function generateEnemyStats(type: 'field' | 'boss' | 'special', playerLevel: number, locationId: number = 1) {
  const locationMultiplier = 1 + (locationId - 1) * 0.75;
  if (type === 'field') {
    const name = pick(YOKAI_NAMES);
    const lvl = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
    const baseHp = lvl * 30 + 50;
    const baseAtk = lvl * 8 + 10;
    const baseDef = lvl * 5 + 5;
    const baseSpd = lvl * 4 + 8;

    return {
      name,
      level: lvl,
      hp: Math.floor(baseHp * Math.pow(locationMultiplier, 1.2)),
      maxHp: Math.floor(baseHp * Math.pow(locationMultiplier, 1.2)),
      attack: Math.floor(baseAtk * Math.pow(locationMultiplier, 1.1)),
      defense: Math.floor(baseDef * Math.pow(locationMultiplier, 1.1)),
      speed: Math.floor(baseSpd * locationMultiplier),
      skills: ["Scratch", "Bite"],
    };
  } else if (type === 'boss') {
    const name = pick(BOSS_NAMES);
    const difficultyMultiplier = locationId * 1.5;
    const lvl = Math.floor(playerLevel + 5 + (locationId * 8));
    return {
      name,
      level: lvl,
      hp: Math.floor((lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000)) * locationMultiplier),
      maxHp: Math.floor((lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000)) * locationMultiplier),
      attack: Math.floor((lvl * 25 + 60 + Math.floor(difficultyMultiplier * 50)) * locationMultiplier),
      defense: Math.floor((lvl * 20 + 50 + Math.floor(difficultyMultiplier * 40)) * locationMultiplier),
      speed: Math.floor((lvl * 12 + 25 + Math.floor(difficultyMultiplier * 20)) * locationMultiplier),
      skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    const lvl = Math.floor(playerLevel + 15 + (locationId * 12));
    return {
      name: sb.name,
      level: lvl,
      hp: Math.floor((lvl * 250 + 2000 + (locationId * 3000)) * locationMultiplier),
      maxHp: Math.floor((lvl * 250 + 2000 + (locationId * 3000)) * locationMultiplier),
      attack: Math.floor((lvl * 50 + 250 + (locationId * 150)) * locationMultiplier),
      defense: Math.floor((lvl * 40 + 200 + (locationId * 120)) * locationMultiplier),
      speed: Math.floor((lvl * 20 + 80 + (locationId * 50)) * locationMultiplier),
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

  app.get("/api/quarters", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    let q = await storage.getQuarters(userId);
    if (!q) {
      q = await storage.createQuarters({ userId, availableSlots: 4, totalGoldSpent: 0, lastIncomeAt: new Date() });
    }
    const structs = await storage.getStructures(q.id);
    res.json({ ...q, structures: structs });
  });

  app.post("/api/quarters/build", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { type, positionX, positionY } = req.body;
    
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const costs: Record<string, number> = { merchant_guild: 500 };
    const cost = costs[type] || 500;

    if (user.gold < cost) return res.status(400).json({ message: "Not enough gold" });

    let q = await storage.getQuarters(userId);
    if (!q) {
      q = await storage.createQuarters({ userId, availableSlots: 4, totalGoldSpent: 0, lastIncomeAt: new Date() });
    }

    const structs = await storage.getStructures(q.id);
    if (structs.length >= q.availableSlots) return res.status(400).json({ message: "No available slots" });

    await storage.updateUser(userId, { gold: user.gold - cost });
    await storage.updateQuarters(q.id, { totalGoldSpent: q.totalGoldSpent + cost });

    const newStruct = await storage.createStructure({
      quartersId: q.id,
      type,
      tier: 1,
      level: 1,
      positionX,
      positionY,
      incomeBonus: 10,
      nextUpkeepAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    res.json(newStruct);
  });

  app.post("/api/quarters/collect", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const q = await storage.getQuarters(userId);
    if (!q) return res.status(404).json({ message: "Quarters not found" });

    const structs = await storage.getStructures(q.id);
    const merchantGuilds = structs.filter(s => s.type === 'merchant_guild');
    
    const now = new Date();
    const lastCollect = q.lastIncomeAt ? new Date(q.lastIncomeAt) : new Date();
    const hoursPassed = Math.floor((now.getTime() - lastCollect.getTime()) / (1000 * 60 * 60));

    if (hoursPassed < 1) return res.json({ collected: 0, message: "Too soon to collect" });

    const totalBonusPct = merchantGuilds.reduce((sum, s) => sum + s.incomeBonus, 0);
    const baseRicePerHour = 10;
    const riceGained = Math.floor(hoursPassed * baseRicePerHour * (1 + totalBonusPct / 100));

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { rice: user.rice + riceGained });
    await storage.updateQuarters(q.id, { lastIncomeAt: now });

    res.json({ riceGained });
  });

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

    const rarityStones: Record<string, number> = { 
      white: 1, green: 2, blue: 5, purple: 10, gold: 25,
      mythic: 50, exotic: 100, transcendent: 250, celestial: 500, primal: 1000
    };
    const stonesGained = rarityStones[targetEquip.rarity] || 1;

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + stonesGained });
    await storage.deleteEquipment(equipId);

    res.json({ stonesGained });
  });

  app.post("/api/equipment/recycle-rarity", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { rarity } = req.body;
    
    try {
      const result = await (storage as any).recycleEquipmentByRarity(userId, rarity);
      res.json(result);
    } catch (error) {
      console.error("Recycle rarity error:", error);
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
    const updated = await storage.updatePet(petId, { isActive: !pet.isActive });
    res.json(updated);
  });

  app.post("/api/pets/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId = Number(req.params.id);
    const allPets = await storage.getPets(userId);
    const targetPet = allPets.find(p => p.id === petId);
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

  app.get(api.horses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getHorses(userId));
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
    const updated = await storage.updateHorse(horseId, { isActive: !horse.isActive });
    res.json(updated);
  });

  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { amount = 1 } = req.body;
    const riceCost = 100 * amount;
    const user = await storage.getUser(userId);
    if (!user || user.rice < riceCost) return res.status(400).json({ message: "Not enough rice" });

    await storage.updateUser(userId, { rice: user.rice - riceCost });

    const results = [];
    for (let i = 0; i < amount; i++) {
      const typeRoll = Math.random();
      if (typeRoll < 0.3) {
        const rarity = rarityFromRandom();
        const comp = await storage.createCompanion({
          userId,
          name: pick(WEAPON_NAMES),
          type: "warrior",
          rarity,
          level: 1,
          experience: 0,
          expToNext: 100,
          hp: 100,
          maxHp: 100,
          attack: 10,
          defense: 10,
          speed: 10,
          isInParty: false,
          isSpecial: false
        });
        results.push({ type: 'companion', data: comp });
      } else if (typeRoll < 0.6) {
        const type = pick(EQUIP_TYPES);
        const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
        const rarity = equipRarityFromRandom();
        const equip = await storage.createEquipment({
          userId,
          name,
          type,
          rarity,
          level: 1,
          experience: 0,
          expToNext: 100,
          attackBonus: 5,
          defenseBonus: 5,
          speedBonus: 5,
          critChance: 5,
          critDamage: 50,
          endowmentPoints: 0,
          isEquipped: false,
          equippedToId: null,
          equippedToType: null
        });
        results.push({ type: 'equipment', data: equip });
      } else if (typeRoll < 0.8) {
        const petData = pick(PET_NAMES);
        const pet = await storage.createPet({
          userId,
          name: petData.name,
          type: "spirit",
          rarity: equipRarityFromRandom(),
          level: 1,
          experience: 0,
          expToNext: 100,
          hp: 50,
          maxHp: 50,
          attack: 5,
          defense: 5,
          speed: 20,
          skill: petData.skill,
          isActive: false
        });
        results.push({ type: 'pet', data: pet });
      } else {
        const horse = await storage.createHorse(generateHorse(userId));
        results.push({ type: 'horse', data: horse });
      }
    }
    res.json(results);
  });

  app.post(api.combat.field.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.stamina < 10) return res.status(400).json({ message: "Not enough stamina" });

    const team = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('field', user.level, user.currentLocationId);
    const battleResult = runTurnBasedCombat(team, enemy);

    if (battleResult.winner === 'player') {
      const goldGained = Math.floor(user.level * 10 * (1 + (user.currentLocationId - 1) * 0.5));
      const riceGained = Math.floor(user.level * 5 * (1 + (user.currentLocationId - 1) * 0.5));
      const expGained = 20;

      let newExp = user.experience + expGained;
      let newLevel = user.level;
      let newHp = user.maxHp;
      let newMaxHp = user.maxHp;
      let newAtk = user.attack;
      let newDef = user.defense;
      let newSpd = user.speed;

      while (newExp >= 100 * newLevel) {
        newExp -= 100 * newLevel;
        newLevel++;
        newMaxHp += 20;
        newHp = newMaxHp;
        newAtk += 5;
        newDef += 5;
        newSpd += 2;
      }

      const updates: any = {
        gold: user.gold + goldGained,
        rice: user.rice + riceGained,
        experience: newExp,
        level: newLevel,
        maxHp: newMaxHp,
        hp: newHp,
        attack: newAtk,
        defense: newDef,
        speed: newSpd,
        stamina: user.stamina - 10,
      };

      if (Math.random() > 0.8) updates.upgradeStones = (user.upgradeStones || 0) + 1;
      if (Math.random() > 0.95) updates.transformationStones = (user.transformationStones || 0) + 1;

      await storage.updateUser(userId, updates);
      battleResult.rewards = { gold: goldGained, rice: riceGained, exp: expGained };
    } else {
      await storage.updateUser(userId, { stamina: user.stamina - 10 });
    }

    res.json(battleResult);
  });

  app.post(api.combat.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.stamina < 30) return res.status(400).json({ message: "Not enough stamina" });

    const team = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('boss', user.level, user.currentLocationId);
    const battleResult = runTurnBasedCombat(team, enemy);

    if (battleResult.winner === 'player') {
      const goldGained = Math.floor(user.level * 100 * user.currentLocationId);
      const riceGained = Math.floor(user.level * 50 * user.currentLocationId);
      const stones = 5;
      
      const updates: any = {
        gold: user.gold + goldGained,
        rice: user.rice + riceGained,
        stamina: user.stamina - 30,
        upgradeStones: (user.upgradeStones || 0) + stones,
      };

      if (user.currentLocationId < 4) updates.currentLocationId = user.currentLocationId + 1;

      await storage.updateUser(userId, updates);
      battleResult.rewards = { gold: goldGained, rice: riceGained, stones };
    } else {
      await storage.updateUser(userId, { stamina: user.stamina - 30 });
    }

    res.json(battleResult);
  });

  app.post(api.combat.specialBoss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user || user.stamina < 50) return res.status(400).json({ message: "Not enough stamina" });

    const team = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('special', user.level, user.currentLocationId);
    const battleResult = runTurnBasedCombat(team, enemy);

    if (battleResult.winner === 'player') {
      const sb = SPECIAL_BOSSES.find(s => s.name === enemy.name);
      if (sb) {
        await storage.createTransformation({
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
          durationSeconds: 30
        });
      }
      await storage.updateUser(userId, { stamina: user.stamina - 50 });
      battleResult.rewards = { transform: sb?.transformName };
    } else {
      await storage.updateUser(userId, { stamina: user.stamina - 50 });
    }
    res.json(battleResult);
  });

  app.post("/api/player/transform", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { transformId } = req.body;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const transforms = await storage.getTransformations(userId);
    const target = transforms.find(t => t.id === transformId);
    if (!target) return res.status(404).json({ message: "Transformation not found" });

    const activeUntil = new Date(Date.now() + target.durationSeconds * 1000);
    await storage.updateUser(userId, {
      activeTransformId: transformId,
      transformActiveUntil: activeUntil
    });

    res.json({ activeUntil });
  });

  app.post("/api/player/restart", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.restartGame(userId);
    res.json({ success: true });
  });

  return httpServer;
}
