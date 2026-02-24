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
  // Significantly improved rarity rates for normal enemies
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
    
    // Check for active transformation
    let activeTransform = null;
    if (user.activeTransformId && user.transformActiveUntil && new Date(user.transformActiveUntil) > new Date()) {
      activeTransform = allTransforms.find(t => t.id === user.activeTransformId);
    }

    const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
    const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
    const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);

    // Base stats
    let hp = user.hp + (user.permHpBonus || 0);
    let maxHp = user.maxHp + (user.permHpBonus || 0);
    let attack = user.attack + totalAtkBonus + (user.permAttackBonus || 0);
    let defense = user.defense + totalDefBonus + (user.permDefenseBonus || 0);
    let speed = user.speed + totalSpdBonus + (user.permSpeedBonus || 0);

    // Apply transformation bonuses
    if (activeTransform) {
      attack = Math.floor(attack * (1 + activeTransform.attackPercent / 100));
      defense = Math.floor(defense * (1 + activeTransform.defensePercent / 100));
      speed = Math.floor(speed * (1 + activeTransform.speedPercent / 100));
      const hpBonus = Math.floor(maxHp * (activeTransform.hpPercent / 100));
      maxHp += hpBonus;
      hp += hpBonus;
    }

    // Aggregate stats
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

  // Apply horse bonuses to the whole party if active
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
  if (type === 'field') {
    const name = pick(YOKAI_NAMES);
    const lvl = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
    return {
      name,
      level: lvl,
      hp: lvl * 30 + 50,
      maxHp: lvl * 30 + 50,
      attack: lvl * 8 + 10,
      defense: lvl * 5 + 5,
      speed: lvl * 4 + 8,
      skills: ["Scratch", "Bite"],
    };
  } else if (type === 'boss') {
    const name = pick(BOSS_NAMES);
    // Bosses scale more significantly with location
    const difficultyMultiplier = locationId * 1.5;
    const lvl = Math.floor(playerLevel + 5 + (locationId * 8));
    return {
      name,
      level: lvl,
      hp: lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000),
      maxHp: lvl * 150 + 500 + Math.floor(difficultyMultiplier * 1000),
      attack: lvl * 25 + 60 + Math.floor(difficultyMultiplier * 50),
      defense: lvl * 20 + 50 + Math.floor(difficultyMultiplier * 40),
      speed: lvl * 12 + 25 + Math.floor(difficultyMultiplier * 20),
      skills: ["War Cry", "Shield Wall", "Charge", "Strategic Strike"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    // Special bosses are the ultimate challenge
    const lvl = Math.floor(playerLevel + 15 + (locationId * 12));
    return {
      name: sb.name,
      level: lvl,
      hp: lvl * 250 + 2000 + (locationId * 3000),
      maxHp: lvl * 250 + 2000 + (locationId * 3000),
      attack: lvl * 50 + 250 + (locationId * 150),
      defense: lvl * 40 + 200 + (locationId * 120),
      speed: lvl * 20 + 80 + (locationId * 50),
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
    
    // Check for duplicate names in the selected companion IDs
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

    const costPerUpgrade = 1;
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

    // Ensure locationId and repeatCount are parsed as numbers
    const locationId = Number(req.body.locationId) || 1;
    const repeatCount = Number(req.body.repeatCount) || 1;
    const count = Math.min(Math.max(1, repeatCount), 100);

    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    let totalExpGained = 0;
    let totalGoldGained = 0;
    const allEquipmentDropped = [];
    const allPetsDropped = [];
    const allHorsesDropped = [];
    const allLogs: string[] = [];

    for (let i = 0; i < count; i++) {
      if (count > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);
      const enemy = generateEnemyStats('field', user.level, locationId);
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      const victory = battleResult.victory;
      allLogs.push(...battleResult.logs);

      if (victory) {
        // Update user stats with level up logic
        const expGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        const goldGained = Math.floor(Math.random() * 10) + 5 + enemy.level;
        totalExpGained += expGained;
        totalGoldGained += goldGained;
        
        let currentExp = user.experience + totalExpGained;
        let currentLevel = user.level;
        let currentMaxHp = user.maxHp;
        let currentAtk = user.attack;
        let currentDef = user.defense;
        let currentSpd = user.speed;

        while (currentExp >= Math.floor(100 * Math.pow(1.5, currentLevel - 1))) {
          currentExp -= Math.floor(100 * Math.pow(1.5, currentLevel - 1));
          currentLevel++;
          currentMaxHp += 20;
          currentSpd += 2;
        }
        const endowmentStoneGained = Math.random() < 0.4 ? 1 : 0;
        const talismanGained = Math.random() < 0.1 ? 1 : 0;

        const userUpdate: any = {
          level: currentLevel,
          experience: currentExp,
          gold: user.gold + totalGoldGained,
          maxHp: currentMaxHp,
          hp: currentMaxHp,
          attack: currentAtk,
          defense: currentDef,
          speed: currentSpd,
          endowmentStones: (user.endowmentStones || 0) + endowmentStoneGained,
          fireGodTalisman: (user.fireGodTalisman || 0) + talismanGained
        };

        await storage.updateUser(userId, userUpdate);
        if (Math.random() < 0.3) {
          const type = pick(EQUIP_TYPES);
          const rarity = equipRarityFromRandom();
          const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
          
          const statsByRarity: Record<string, { atk: number, def: number, spd: number }> = {
            white: { atk: 5, def: 5, spd: 2 },
            green: { atk: 8, def: 8, spd: 4 },
            blue: { atk: 12, def: 10, spd: 6 },
            purple: { atk: 20, def: 15, spd: 10 },
            gold: { atk: 35, def: 25, spd: 15 },
            mythic: { atk: 60, def: 45, spd: 25 },
            exotic: { atk: 100, def: 75, spd: 45 },
            transcendent: { atk: 200, def: 150, spd: 80 },
            celestial: { atk: 450, def: 350, spd: 150 },
            primal: { atk: 1000, def: 800, spd: 300 }
          };
          const baseStats = statsByRarity[rarity] || statsByRarity.white;

          const eq = await storage.createEquipment({
            userId,
            name,
            type,
            rarity,
            level: 1,
            experience: 0,
            expToNext: 100,
            attackBonus: baseStats.atk,
            defenseBonus: baseStats.def,
            speedBonus: baseStats.spd,
          });
          allEquipmentDropped.push(eq);
          allLogs.push(`Found ${rarity.toUpperCase()} ${name}!`);
        }

        // Pet Drop (15% chance)
        if (Math.random() < 0.15) {
          const pInfo = pick(PET_NAMES);
          const rarityStr = equipRarityFromRandom();
          try {
            const petDropped = await storage.createPet({
              userId,
              name: pInfo.name,
              type: 'spirit',
              rarity: rarityStr,
              level: 1,
              experience: 0,
              expToNext: 100,
              hp: 30,
              maxHp: 30,
              attack: 5,
              defense: 5,
              speed: 15,
              skill: pInfo.skill,
              isActive: false,
            });
            allPetsDropped.push(petDropped);
            allLogs.push(`Captured ${rarityStr.toUpperCase()} ${pInfo.name}!`);
          } catch (err) {
            console.error("Failed to create pet drop:", err);
          }
        }

        // Horse Drop (5% chance)
        if (Math.random() < 0.05) {
          const horseData = generateHorse(userId);
          try {
            const horse = await storage.createHorse(horseData as any);
            allHorsesDropped.push(horse);
            allLogs.push(`HORSES: You managed to tame a wild ${horse.name}!`);
          } catch (err) {
            console.error("Failed to create horse drop:", err);
          }
        }
      }
    }

    if (totalExpGained > 0) {
      // Handled in loop
    } else if (totalGoldGained > 0) {
      await storage.updateUser(userId, {
        gold: user.gold + totalGoldGained,
      });
    }
    
    // Always give equipment exp at the end
    if (count > 0) {
      await giveEquipmentExp(userId, 10 * count);
    }

    res.json({
      victory: totalExpGained > 0,
      experienceGained: totalExpGained,
      goldGained: totalGoldGained,
      equipmentDropped: allEquipmentDropped,
      petDropped: allPetsDropped[0] || null,
      allPetsDropped,
      horseDropped: allHorsesDropped[0] || null,
      allHorsesDropped,
      logs: allLogs
    });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('boss', user.level, locationId);
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      const expGained = 100 + (locationId * 50);
      const goldGained = 50 + (locationId * 25);
      const riceGained = 10 + (locationId * 5);
      const endowmentStones = 2 + Math.floor(Math.random() * 3); // 2-4 stones

      // Level up logic
      let currentExp = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentAtk = user.attack;
      let currentDef = user.defense;
      let currentSpd = user.speed;

      while (currentExp >= Math.floor(100 * Math.pow(1.5, currentLevel - 1))) {
        currentExp -= Math.floor(100 * Math.pow(1.5, currentLevel - 1));
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
        speed: currentSpd
      });
      
      const type = pick(EQUIP_TYPES);
      
      // Significantly improved drop rates for field battles
      const fieldRarity = equipRarityFromRandom();
      const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
      
      const statsByRarity: Record<string, { atk: number, def: number, spd: number, critC: number, critD: number }> = {
        white: { atk: 5, def: 3, spd: 2, critC: 0, critD: 0 },
        green: { atk: 10, def: 6, spd: 4, critC: 0, critD: 0 },
        blue: { atk: 15, def: 10, spd: 6, critC: 0, critD: 0 },
        purple: { atk: 25, def: 18, spd: 10, critC: 2, critD: 5 },
        gold: { atk: 40, def: 30, spd: 20, critC: 5, critD: 15 },
        mythic: { atk: 60, def: 45, spd: 25, critC: 8, critD: 20 },
        exotic: { atk: 100, def: 75, spd: 45, critC: 12, critD: 35 },
        transcendent: { atk: 200, def: 150, spd: 80, critC: 20, critD: 60 },
        celestial: { atk: 450, def: 350, spd: 150, critC: 35, critD: 120 },
        primal: { atk: 1000, def: 800, spd: 300, critC: 60, critD: 300 }
      };
      const baseStats = statsByRarity[fieldRarity] || statsByRarity.white;

      const itemData: any = {
        userId,
        name,
        type,
        rarity: fieldRarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: baseStats.atk + (locationId * 5),
        defenseBonus: baseStats.def + (locationId * 3),
        speedBonus: baseStats.spd + (locationId * 2),
        critChance: 0,
        critDamage: 0,
      };

      // Apply critical stats based on type and rarity
      if (['gold', 'mythic', 'exotic', 'transcendent', 'celestial', 'primal'].includes(fieldRarity)) {
        if (type === 'weapon') {
          itemData.critDamage = baseStats.critD;
        } else if (type === 'accessory') {
          itemData.critChance = baseStats.critC;
        }
      }

      const eq = await storage.createEquipment(itemData);

      res.json({ 
        victory: true, 
        experienceGained: expGained, 
        goldGained: goldGained, 
        riceGained: riceGained, 
        equipmentDropped: [eq],
        logs 
      });
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
    const enemy = generateEnemyStats('special', user.level, locationId);
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      const expGained = 250 + (locationId * 100);
      const goldGained = 150 + (locationId * 75);
      const endowmentStones = 5 + Math.floor(Math.random() * 6); // 5-10 stones

      let currentExp = user.experience + expGained;
      let currentLevel = user.level;
      let currentMaxHp = user.maxHp;
      let currentAtk = user.attack;
      let currentDef = user.defense;
      let currentSpd = user.speed;

      while (currentExp >= Math.floor(100 * Math.pow(1.5, currentLevel - 1))) {
        currentExp -= Math.floor(100 * Math.pow(1.5, currentLevel - 1));
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
        speed: currentSpd
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
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    
    const cost = isSpecial ? 50 : 10;
    if (user.rice < cost) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - cost });

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

    const warrior = pick(warriorPool);
    
    const rarityFromSpecial = () => {
      const r = Math.random();
      if (r > 0.85) return "5"; // 15%
      if (r > 0.60) return "4"; // 25%
      if (r > 0.30) return "3"; // 30%
      return "2";               // 30% (No 1-star)
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
    res.json({ companion });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.rice < 15) return res.status(400).json({ message: "Not enough rice" });
    
    await storage.updateUser(userId, { rice: user.rice - 15 });
    
    const type = pick(EQUIP_TYPES);
    
    // Improved Rates for Special Gacha: No more common (white) to epic (purple)
    // Only Gold and above
    const r = Math.random();
    let rarity = 'gold';
    if (r > 0.98) rarity = 'primal';           // 2% (was 0.1%)
    else if (r > 0.94) rarity = 'celestial';  // 4% (was 0.4%)
    else if (r > 0.88) rarity = 'transcendent'; // 6% (was 1.0%)
    else if (r > 0.78) rarity = 'exotic';      // 10% (was 2.0%)
    else if (r > 0.60) rarity = 'mythic';       // 18% (was 6.5%)
    else rarity = 'gold';                       // 60% (was 90%)

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
      celestial: { atk: 450, def: 350, spd: 150 },
      primal: { atk: 1000, def: 800, spd: 300 }
    };
    const baseStats = statsByRarity[rarity];

    const equipment = await storage.createEquipment({
      userId,
      name,
      type,
      rarity,
      level: 1,
      experience: 0,
      expToNext: 100,
      attackBonus: baseStats.atk,
      defenseBonus: baseStats.def,
      speedBonus: baseStats.spd,
    });
    res.json({ equipment });
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
    const { type, protect } = req.body; // type: 'normal', 'advanced', 'extreme'
    
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const equips = await storage.getEquipment(userId);
    const eq = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });

    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });

    // Success Rates: Base 90% - (CurrentPoints * 2%)
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

  app.post(api.restart.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    res.json({ success: true });
  });

  return httpServer;
}
