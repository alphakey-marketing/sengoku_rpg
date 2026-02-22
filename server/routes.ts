import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api, buildUrl } from "@shared/routes";

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
  if (r > 0.95) return 'gold';
  if (r > 0.85) return 'purple';
  if (r > 0.65) return 'blue';
  if (r > 0.4) return 'green';
  return 'white';
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
      hp: user.hp,
      maxHp: user.maxHp,
      attack: user.attack + totalAtkBonus + horseAtkBonus,
      defense: user.defense + totalDefBonus,
      speed: user.speed + totalSpdBonus + horseSpdBonus,
      equipped: playerEquipped.map(e => ({ name: e.name, type: e.type, level: e.level, rarity: e.rarity })),
      canTransform: allTransforms.length > 0,
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
    const lvl = playerLevel + 3;
    return {
      name,
      level: lvl,
      hp: lvl * 80 + 200,
      maxHp: lvl * 80 + 200,
      attack: lvl * 15 + 30,
      defense: lvl * 12 + 25,
      speed: lvl * 6 + 10,
      skills: ["War Cry", "Shield Wall", "Charge"],
    };
  } else {
    const sb = pick(SPECIAL_BOSSES);
    const lvl = playerLevel + 8;
    return {
      name: sb.name,
      level: lvl,
      hp: lvl * 120 + 500,
      maxHp: lvl * 120 + 500,
      attack: lvl * 25 + 80,
      defense: lvl * 20 + 60,
      speed: lvl * 10 + 20,
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
    for (const comp of allComps) {
      const shouldBeInParty = companionIds.includes(comp.id);
      if (comp.isInParty !== shouldBeInParty) {
        await storage.updateCompanion(comp.id, { isInParty: shouldBeInParty });
      }
    }
    res.json(await storage.getCompanions(userId));
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

    // Enforce one-per-type: unequip same-type item on same target
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

    const rarityStones: Record<string, number> = { white: 1, green: 2, blue: 5, purple: 10, gold: 25 };
    const stonesGained = rarityStones[targetEquip.rarity] || 1;

    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + stonesGained });
    // Assuming deleteEquipment is not in IStorage, we use updateEquipment with a flag or just filter it out in getEquipment
    // Since IStorage doesn't have delete, I'll use a hack or just update it to "deleted" state if I could, 
    // but better to add delete to IStorage if I can't.
    // Actually, I'll just use db directly if needed or assume I can update IStorage.
    // Let's check IStorage again. It doesn't have delete.
    // I'll update the item to be "recycled" by setting userId to a special value or just adding delete to storage.
    // I'll add deleteEquipment to storage.ts in the same turn.
    await (storage as any).deleteEquipment(equipId);

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

    const expAmount = 50; // Each stone gives 50 exp
    let newExp = eq.experience + expAmount;
    let newLevel = eq.level;
    let newExpToNext = eq.expToNext;
    let atkBonus = eq.attackBonus;
    let defBonus = eq.defenseBonus;
    let spdBonus = eq.speedBonus;

    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel++;
      newExpToNext = calcEquipExpToNext(newLevel);
      atkBonus = Math.floor(atkBonus * 1.05) + 1;
      defBonus = Math.floor(defBonus * 1.08) + 1;
      spdBonus = Math.floor(spdBonus * 1.1) + 1;
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

      while (newExp >= newExpToNext) {
        newExp -= newExpToNext;
        newLevel++;
        newExpToNext = calcEquipExpToNext(newLevel);
        atkBonus = Math.floor(atkBonus * 1.05) + 1;
        defBonus = Math.floor(defBonus * 1.08) + 1;
        spdBonus = Math.floor(spdBonus * 1.1) + 1;
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

    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('field', user.level);
    const playerPower = (teamStats?.player.attack || user.attack) + (teamStats?.player.speed || user.speed);
    const enemyPower = enemy.attack + enemy.speed;
    const victory = playerPower + Math.random() * 30 > enemyPower;

    const logs: string[] = [];
    logs.push(`A wild ${enemy.name} (Lv${enemy.level}) appeared!`);

    if (teamStats && teamStats.player.speed > enemy.speed) {
      logs.push(`Your speed (${teamStats.player.speed}) lets you strike first!`);
    }

    const expGained = victory ? Math.floor(Math.random() * 20) + 10 + enemy.level * 2 : 0;
    const goldGained = victory ? Math.floor(Math.random() * 10) + 5 + enemy.level : 0;
    const equipExpGained = victory ? Math.floor(Math.random() * 15) + 5 : 0;

    if (victory) {
      logs.push(`You struck down the ${enemy.name}!`);
      logs.push("Victory!");

      const newExp = user.experience + expGained;
      let newLevel = user.level;
      let atkInc = 0, defInc = 0, spdInc = 0, hpInc = 0;
      if (newExp >= user.level * 100) {
        newLevel++;
        atkInc = 5; defInc = 5; spdInc = 3; hpInc = 20;
      }

      await storage.updateUser(userId, {
        experience: newExp >= user.level * 100 ? newExp - user.level * 100 : newExp,
        level: newLevel,
        gold: user.gold + goldGained,
        attack: user.attack + atkInc,
        defense: user.defense + defInc,
        speed: user.speed + spdInc,
        maxHp: user.maxHp + hpInc,
        hp: Math.min(user.hp, user.maxHp + hpInc),
      });

      await giveEquipmentExp(userId, equipExpGained);
    } else {
      logs.push(`The ${enemy.name} was too powerful...`);
      logs.push("Defeat!");
    }

    let dropped: any[] = [];
    let petDropped = null;
    let horseDropped = null;

    if (victory) {
      if (Math.random() > 0.6) {
        const eqType = pick(EQUIP_TYPES);
        const names = eqType === 'weapon' ? WEAPON_NAMES : eqType === 'armor' ? ARMOR_NAMES : eqType === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES;
        const drop = await storage.createEquipment({
          userId,
          name: pick(names),
          type: eqType,
          rarity: rarityFromRandom(),
          level: 1,
          experience: 0,
          expToNext: 100,
          attackBonus: eqType === 'weapon' ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 2),
          defenseBonus: eqType === 'armor' ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 2),
          speedBonus: eqType === 'accessory' ? Math.floor(Math.random() * 4) + 2 : eqType === 'horse_gear' ? Math.floor(Math.random() * 6) + 4 : Math.floor(Math.random() * 2),
        });
        dropped.push(drop);
      }

      if (Math.random() > 0.92) {
        const petInfo = pick(PET_NAMES);
        petDropped = await storage.createPet({
          userId,
          name: petInfo.name,
          type: "yokai",
          rarity: Math.random() > 0.7 ? 4 : 3,
          level: 1,
          hp: 30,
          maxHp: 30,
          attack: Math.floor(Math.random() * 5) + 5,
          defense: Math.floor(Math.random() * 5) + 3,
          speed: Math.floor(Math.random() * 5) + 10,
          skill: petInfo.skill,
        });
      }

      if (Math.random() > 0.95) {
        horseDropped = await storage.createHorse({
          userId,
          name: pick(HORSE_NAMES),
          rarity: Math.random() > 0.8 ? 4 : 3,
          level: 1,
          speedBonus: Math.floor(Math.random() * 10) + 15,
          attackBonus: Math.floor(Math.random() * 5) + 3,
          skill: "Charge (突撃)",
        });
      }
    }

    res.json({
      victory,
      experienceGained: expGained,
      goldGained,
      equipmentExpGained: equipExpGained,
      equipmentDropped: dropped,
      petDropped,
      horseDropped,
      logs,
      playerTeam: teamStats,
      enemyTeam: { enemies: [enemy] },
    });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('boss', user.level);
    const totalTeamPower = (teamStats?.player.attack || user.attack) * 1.5 +
      (teamStats?.companions || []).reduce((s: number, c: any) => s + c.attack, 0);
    const victory = totalTeamPower + Math.random() * 50 > enemy.attack * 2;

    const logs: string[] = [];
    logs.push(`You challenged ${enemy.name} (Lv${enemy.level})!`);
    logs.push("The castle gates open...");

    const expGained = victory ? 100 + enemy.level * 5 : 0;
    const goldGained = victory ? 50 + enemy.level * 3 : 0;
    const riceGained = victory ? 15 : 0;
    const equipExpGained = victory ? 30 : 0;

    if (victory) {
      logs.push(`${enemy.name} has fallen!`);
      logs.push("Glorious Victory!");

      await storage.updateUser(userId, {
        experience: user.experience + expGained,
        gold: user.gold + goldGained,
        rice: user.rice + riceGained,
      });

      await giveEquipmentExp(userId, equipExpGained);
    } else {
      logs.push(`${enemy.name} proved too powerful...`);
      logs.push("Retreat!");
    }

    let dropped: any[] = [];
    if (victory && Math.random() > 0.3) {
      const eqType = pick(EQUIP_TYPES);
      const names = eqType === 'weapon' ? WEAPON_NAMES : eqType === 'armor' ? ARMOR_NAMES : eqType === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES;
      const drop = await storage.createEquipment({
        userId,
        name: `${enemy.name}'s ${pick(names)}`,
        type: eqType,
        rarity: Math.random() > 0.5 ? 'purple' : 'blue',
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: Math.floor(Math.random() * 10) + 5,
        defenseBonus: Math.floor(Math.random() * 10) + 5,
        speedBonus: Math.floor(Math.random() * 5) + 2,
      });
      dropped.push(drop);
    }

    res.json({
      victory,
      experienceGained: expGained,
      goldGained,
      riceGained,
      equipmentExpGained: equipExpGained,
      equipmentDropped: dropped,
      logs,
      playerTeam: teamStats,
      enemyTeam: { enemies: [enemy] },
    });
  });

  // Special Boss - drops transformation
  app.post(api.battle.specialBoss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('special', user.level);
    const sb = pick(SPECIAL_BOSSES);

    const totalTeamPower = (teamStats?.player.attack || user.attack) * 2 +
      (teamStats?.companions || []).reduce((s: number, c: any) => s + c.attack + c.defense, 0) +
      (teamStats?.pet?.attack || 0) +
      (teamStats?.horse?.attackBonus || 0);
    const victory = totalTeamPower + Math.random() * 100 > enemy.attack * 2.5;

    const logs: string[] = [];
    logs.push(`A terrible presence... ${enemy.name} (Lv${enemy.level}) appears!`);
    logs.push("The ground trembles with dark energy...");

    if (victory) {
      const expGained = 300 + enemy.level * 10;
      const goldGained = 200 + enemy.level * 8;
      const riceGained = 30;

      logs.push(`After a grueling battle, ${enemy.name} is defeated!`);
      logs.push("A mystical stone drops... 変身石 acquired!");

      await storage.updateUser(userId, {
        experience: user.experience + expGained,
        gold: user.gold + goldGained,
        rice: user.rice + riceGained,
      });

      await giveEquipmentExp(userId, 50);

      const transformation = await storage.createTransformation({
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

      res.json({
        victory: true,
        experienceGained: expGained,
        goldGained,
        riceGained,
        equipmentExpGained: 50,
        transformationDropped: transformation,
        logs,
        playerTeam: teamStats,
        enemyTeam: { enemies: [enemy] },
      });
    } else {
      logs.push(`${enemy.name}'s power was overwhelming...`);
      logs.push("You barely escaped with your life!");

      res.json({
        victory: false,
        experienceGained: 0,
        goldGained: 0,
        logs,
        playerTeam: teamStats,
        enemyTeam: { enemies: [enemy] },
      });
    }
  });

  // Gacha
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.rice < 10) {
      return res.status(400).json({ message: "Not enough rice (need 10)" });
    }

    await storage.updateUser(userId, { rice: user.rice - 10 });

    const isHistorical = Math.random() > 0.5;
    const name = isHistorical
      ? pick(["Oda Nobunaga", "Toyotomi Hideyoshi", "Tokugawa Ieyasu", "Sanada Yukimura", "Date Masamune", "Takeda Shingen"])
      : pick(["Kunoichi", "Sohei Monk", "Ronin", "Onmyoji", "Miko Priestess", "Ashigaru Captain"]);

    const rarity = Math.random() > 0.9 ? 5 : (Math.random() > 0.7 ? 4 : 3);

    const companion = await storage.createCompanion({
      userId,
      name,
      type: isHistorical ? 'historical' : 'original',
      rarity,
      level: 1,
      hp: rarity * 20 + 30,
      maxHp: rarity * 20 + 30,
      attack: rarity * 10,
      defense: rarity * 10,
      speed: rarity * 5 + 5,
      skill: pick(["Slash", "Guard", "Rally", "Ambush", "Heal"]),
    });

    res.json({ companion });
  });

  return httpServer;
}
