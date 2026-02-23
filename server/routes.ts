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

function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.999995) return 'primal';      // 0.0005%
  if (r > 0.99998) return 'celestial';    // 0.0015%
  if (r > 0.99995) return 'transcendent'; // 0.003%
  if (r > 0.9998) return 'exotic';        // 0.015%
  if (r > 0.999) return 'mythic';         // 0.08%
  if (r > 0.991) return 'gold';           // 0.9%
  if (r > 0.971) return 'purple';         // 2%
  if (r > 0.901) return 'blue';           // 7%
  if (r > 0.701) return 'green';          // 20%
  return 'white';                         // 70%
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
  const totalAtkBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
  const totalDefBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
  const totalSpdBonus = playerEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
  const horseSpdBonus = activeHorse ? Math.floor(activeHorse.speedBonus * (1 + (activeHorse.level - 1) * 0.15)) : 0;
  const horseAtkBonus = activeHorse ? Math.floor(activeHorse.attackBonus * (1 + (activeHorse.level - 1) * 0.05)) : 0;

  return {
    player: {
      name: user.firstName || 'Wandering Samurai',
      level: user.level,
      hp: user.hp + (user.permHpBonus || 0),
      maxHp: user.maxHp + (user.permHpBonus || 0),
      attack: user.attack + totalAtkBonus + horseAtkBonus + (user.permAttackBonus || 0),
      defense: user.defense + totalDefBonus + (user.permDefenseBonus || 0),
      speed: user.speed + totalSpdBonus + horseSpdBonus + (user.permSpeedBonus || 0),
      equipped: playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
      canTransform: allTransforms.length > 0,
      seppukuCount: user.seppukuCount || 0,
      permStats: {
        attack: user.permAttackBonus || 0,
        defense: user.permDefenseBonus || 0,
        speed: user.permSpeedBonus || 0,
        hp: user.permHpBonus || 0,
      }
    },
    companions: partyCompanions.map(c => {
      const compEquipped = equips.filter(e => e.isEquipped && e.equippedToType === 'companion' && e.equippedToId === c.id);
      const cAtkBonus = compEquipped.reduce((s, e) => s + Math.floor(e.attackBonus * (1 + (e.level - 1) * 0.05)), 0);
      const cDefBonus = compEquipped.reduce((s, e) => s + Math.floor(e.defenseBonus * (1 + (e.level - 1) * 0.08)), 0);
      const cSpdBonus = compEquipped.reduce((s, e) => s + Math.floor(e.speedBonus * (1 + (e.level - 1) * 0.1)), 0);
      return {
        name: c.name,
        level: c.level,
        hp: c.hp,
        maxHp: c.maxHp,
        attack: c.attack + cAtkBonus,
        defense: c.defense + cDefBonus,
        speed: c.speed + cSpdBonus,
        skill: c.skill,
        equipped: compEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
      };
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
      skill: activeHorse.skill,
    } : null,
  };
}

function generateEnemyStats(type: 'field' | 'boss' | 'special', playerLevel: number) {
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
    const lvl = playerLevel + 2 + (locationId * 3);
    return {
      name,
      level: lvl,
      hp: lvl * 100 + 300 + (locationId * 200),
      maxHp: lvl * 100 + 300 + (locationId * 200),
      attack: lvl * 18 + 40 + (locationId * 30),
      defense: lvl * 15 + 35 + (locationId * 25),
      speed: lvl * 8 + 15 + (locationId * 10),
      skills: ["War Cry", "Shield Wall", "Charge"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    const lvl = playerLevel + 5 + (locationId * 5);
    return {
      name: sb.name,
      level: lvl,
      hp: lvl * 150 + 800 + (locationId * 500),
      maxHp: lvl * 150 + 800 + (locationId * 500),
      attack: lvl * 35 + 120 + (locationId * 80),
      defense: lvl * 25 + 100 + (locationId * 60),
      speed: lvl * 12 + 40 + (locationId * 25),
      skills: [sb.skill, "Roar", "Dark Aura"],
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

    const raritySouls: Record<number, number> = { 1: 5, 2: 10, 3: 25, 4: 50, 5: 125 };
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

    const RARITY_GROWTH: Record<number, { hp: number, atk: number, def: number, spd: number }> = {
      1: { hp: 1.05, atk: 1.02, def: 1.03, spd: 1.05 },
      2: { hp: 1.08, atk: 1.04, def: 1.06, spd: 1.08 },
      3: { hp: 1.12, atk: 1.06, def: 1.09, spd: 1.12 },
      4: { hp: 1.15, atk: 1.08, def: 1.12, spd: 1.15 },
      5: { hp: 1.25, atk: 1.12, def: 1.18, spd: 1.25 }
    };

    const growth = RARITY_GROWTH[comp.rarity] || RARITY_GROWTH[1];

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = Math.floor(100 * Math.pow(1.3, newLevel - 1));
      maxHp = Math.floor(maxHp * growth.hp) + 10;
      hp = maxHp;
      atk = Math.floor(atk * growth.atk) + 3;
      def = Math.floor(def * growth.def) + 3;
      spd = Math.floor(spd * growth.spd) + 2;
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

  app.post(api.equipment.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if ((user.upgradeStones || 0) < 1) return res.status(400).json({ message: "Not enough upgrade stones" });

    const equips = await storage.getEquipment(userId);
    const eq = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });

    await storage.updateUser(userId, { upgradeStones: user.upgradeStones - 1 });

    const expAmount = 50;
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
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if ((user.petEssence || 0) < 10) return res.status(400).json({ message: "Not enough pet essence" });

    const allPets = await storage.getPets(userId);
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    await storage.updateUser(userId, { petEssence: user.petEssence - 10 });

    const expAmount = 50;
    let newExp = pet.experience + expAmount;
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

    const { locationId, repeatCount = 1 } = req.body;
    const count = Math.min(Math.max(1, Number(repeatCount)), 10);

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
      const enemy = generateEnemyStats('field', user.level);
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      const victory = battleResult.victory;
      allLogs.push(...battleResult.logs);

      if (victory) {
        const expGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        const goldGained = Math.floor(Math.random() * 10) + 5 + enemy.level;
        totalExpGained += expGained;
        totalGoldGained += goldGained;
        
        // Update user stats with level up logic
        let newExp = user.experience + expGained;
        let newLevel = user.level;
        let expToNext = Math.floor(100 * Math.pow(1.5, newLevel - 1));

        while (newExp >= expToNext) {
          newExp -= expToNext;
          newLevel++;
          expToNext = Math.floor(100 * Math.pow(1.5, newLevel - 1));
          // Stat increases on level up
          await storage.updateUser(userId, {
            level: newLevel,
            maxHp: user.maxHp + 20,
            hp: user.maxHp + 20,
            attack: user.attack + 5,
            defense: user.defense + 3,
            speed: user.speed + 2,
          });
        }
        await storage.updateUser(userId, { experience: newExp, gold: user.gold + goldGained });
        if (Math.random() < 0.3) {
          const type = pick(EQUIP_TYPES);
          const rarity = rarityFromRandom();
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

        // Pet Drop (10% chance)
        if (Math.random() < 0.1) {
          const pInfo = pick(PET_NAMES);
          const rarity = rarityFromRandom();
          const petDropped = await storage.createPet({
            userId,
            name: pInfo.name,
            type: 'spirit',
            rarity,
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
          allLogs.push(`A ${rarity.toUpperCase()} ${pInfo.name} joined you!`);
        }

        // Horse Drop (5% chance)
        if (Math.random() < 0.05) {
          const hName = pick(HORSE_NAMES);
          const horseDropped = await storage.createHorse({
            userId,
            name: hName,
            rarity: 3,
            level: 1,
            speedBonus: 20,
            attackBonus: 5,
            skill: "Swift Gallop",
            isActive: false,
          });
          allHorsesDropped.push(horseDropped);
          allLogs.push(`Tamed ${hName}!`);
        }
      }
    }

    if (totalExpGained > 0 || totalGoldGained > 0) {
      await storage.updateUser(userId, {
        experience: user.experience + totalExpGained,
        gold: user.gold + totalGoldGained,
      });
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
    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('boss', user.level);
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      await storage.updateUser(userId, { experience: user.experience + 100, rice: user.rice + 10 });
      
      // Boss guaranteed equipment drop
      const type = pick(EQUIP_TYPES);
      const rarity = 'purple';
      const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
      const eq = await storage.createEquipment({
        userId,
        name,
        type,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: 25,
        defenseBonus: 15,
        speedBonus: 10,
      });

      res.json({ 
        victory: true, 
        experienceGained: 100, 
        goldGained: 50, 
        riceGained: 10, 
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
    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('special', user.level);
    const sb = pick(SPECIAL_BOSSES);
    
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    const victory = battleResult.victory;
    const logs = battleResult.logs;

    if (victory) {
      logs.push("A mystical stone drops!");
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
      res.json({ victory: true, transformationDropped: trans, logs, experienceGained: 200, goldGained: 100 });
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
                rarity: 5,
                level: 1,
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
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.rice < 10) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - 10 });

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
    const r = Math.random();
    let rarity = 1;
    if (r > 0.95) rarity = 5;
    else if (r > 0.85) rarity = 4;
    else if (r > 0.65) rarity = 3;
    else if (r > 0.4) rarity = 2;

    const baseStats = {
      1: { hp: 60, atk: 12, def: 10, spd: 10 },
      2: { hp: 80, atk: 15, def: 12, spd: 12 },
      3: { hp: 100, atk: 20, def: 15, spd: 15 },
      4: { hp: 130, atk: 28, def: 22, spd: 20 },
      5: { hp: 180, atk: 40, def: 35, spd: 30 }
    }[rarity] || { hp: 60, atk: 12, def: 10, spd: 10 };

    const companion = await storage.createCompanion({
      userId,
      name: warrior.name,
      type: warrior.type,
      rarity,
      level: 1,
      experience: 0,
      expToNext: 100,
      hp: baseStats.hp,
      maxHp: baseStats.hp,
      attack: baseStats.atk,
      defense: baseStats.def,
      speed: baseStats.spd,
      skill: warrior.skill,
      isInParty: false,
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
    const rarity = rarityFromRandom();

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

  app.post(api.restart.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    res.json({ success: true });
  });

  return httpServer;
}
