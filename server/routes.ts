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
const HORSE_NAMES = ["Kiso Horse (木曽馬)", "Misaki Pony (御崎馬)", "Tokara Stallion (トカラ马)"];

const WEATHER_EFFECTS: Record<string, { name: string, description: string, atkMod: number, defMod: number, spdMod: number }> = {
  clear: { name: "Clear (晴れ)", description: "Standard conditions.", atkMod: 1.0, defMod: 1.0, spdMod: 1.0 },
  rain: { name: "Rain (雨)", description: "Heavy rain dampens gunpowder and slowing movement. Speed -10%, Attack -5%.", atkMod: 0.95, defMod: 1.0, spdMod: 0.9 },
  storm: { name: "Storm (嵐)", description: "Violent winds and rain. Attack -15%, Speed -20%.", atkMod: 0.85, defMod: 1.0, spdMod: 0.8 },
  fog: { name: "Fog (霧)", description: "Dense mist obscures vision. Defense +10%, Speed -10%.", atkMod: 1.0, defMod: 1.1, spdMod: 0.9 },
  snow: { name: "Snow (雪)", description: "Freezing cold biting at the warriors. Speed -15%, Defense -5%.", atkMod: 1.0, defMod: 0.95, spdMod: 0.85 },
};

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
    let user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Dynamic weather update (every 10 minutes)
    const now = new Date();
    const lastUpdate = user.lastWeatherUpdate ? new Date(user.lastWeatherUpdate) : new Date(0);
    if (now.getTime() - lastUpdate.getTime() > 10 * 60 * 1000) {
      const weathers = Object.keys(WEATHER_EFFECTS);
      const newWeather = pick(weathers);
      user = await storage.updateUser(userId, { 
        weather: newWeather, 
        lastWeatherUpdate: now 
      });
    }

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
    
    // Skill Impacts
    let playerAtkMult = 1.0;
    let playerDefMult = 1.0;
    let playerSpdMult = 1.0;
    let enemyAtkMult = 1.0;
    let enemyDefMult = 1.0;
    let enemySpdMult = 1.0;

    const weather = user.weather || 'clear';
    const weatherEffect = WEATHER_EFFECTS[weather] || WEATHER_EFFECTS.clear;
    playerAtkMult *= weatherEffect.atkMod;
    playerDefMult *= weatherEffect.defMod;
    playerSpdMult *= weatherEffect.spdMod;

    const logs: string[] = [];
    logs.push(`A wild ${enemy.name} (Lv${enemy.level}) appeared!`);
    logs.push(`[Weather] ${weatherEffect.name}: ${weatherEffect.description}`);

    if (teamStats) {
      // Passive skills from companions
      teamStats.companions.forEach(c => {
        if ((c as any).skillType === 'passive') {
          if ((c as any).skillEffect === 'atk_buff') {
            const bonus = (c as any).skillValue;
            playerAtkMult += bonus / 100;
            logs.push(`[Skill] ${c.name} activates ${c.skill}: Party Attack +${bonus}%`);
          }
          if ((c as any).skillEffect === 'def_buff') {
            const bonus = (c as any).skillValue;
            playerDefMult += bonus / 100;
            logs.push(`[Skill] ${c.name} activates ${c.skill}: Party Defense +${bonus}%`);
          }
        }
      });

      // Active skills (chance-based for simplification in field battles)
      teamStats.companions.forEach(c => {
        if ((c as any).skillType === 'active' && Math.random() > 0.7) {
          if ((c as any).skillEffect === 'spd_debuff') {
            const debuff = (c as any).skillValue;
            enemySpdMult -= debuff / 100;
            logs.push(`[Skill] ${c.name} uses ${c.skill}: Enemy Speed -${debuff}%`);
          }
        }
      });
    }

    const basePlayerAtk = (teamStats?.player.attack || user.attack);
    const basePlayerSpd = (teamStats?.player.speed || user.speed);
    const finalPlayerAtk = Math.floor(basePlayerAtk * playerAtkMult);
    const finalPlayerSpd = Math.floor(basePlayerSpd * playerSpdMult);
    
    const baseEnemyAtk = enemy.attack;
    const baseEnemySpd = enemy.speed;
    const finalEnemyAtk = Math.floor(baseEnemyAtk * enemyAtkMult);
    const finalEnemySpd = Math.floor(baseEnemySpd * enemySpdMult);

    logs.push(`[Combat] Player Power: ${finalPlayerAtk + finalPlayerSpd} (Atk: ${finalPlayerAtk}, Spd: ${finalPlayerSpd})`);
    logs.push(`[Combat] Enemy Power: ${finalEnemyAtk + finalEnemySpd} (Atk: ${finalEnemyAtk}, Spd: ${finalEnemySpd})`);

    const playerPower = finalPlayerAtk + finalPlayerSpd;
    const enemyPower = finalEnemyAtk + finalEnemySpd;
    
    logs.push(`[Combat] Total Calculation: Player ${playerPower} vs Enemy ${enemyPower}`);
    const roll = Math.floor(Math.random() * 30);
    logs.push(`[Combat] Fortune Roll: +${roll}`);
    
    const victory = playerPower + roll > enemyPower;
    if (teamStats && teamStats.player.speed > enemy.speed) logs.push(`Your speed strikes first!`);

    const expGained = victory ? Math.floor(Math.random() * 20) + 10 + enemy.level * 2 : 0;
    const goldGained = victory ? Math.floor(Math.random() * 10) + 5 + enemy.level : 0;

    if (victory) {
      logs.push("Victory!");
      
      // Level up logic
      let newLevel = user.level;
      let newExp = user.experience + expGained;
      let expToNext = user.level * 100;
      
      while (newExp >= expToNext) {
        newExp -= expToNext;
        newLevel++;
        expToNext = newLevel * 100;
        logs.push(`[Level Up] You reached Level ${newLevel}!`);
      }

      // Drop logic (15% chance for equipment in field battles)
      let droppedEquip = null;
      if (Math.random() < 0.15) {
        const type = pick(EQUIP_TYPES);
        const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
        const rarity = rarityFromRandom();
        droppedEquip = await storage.createEquipment({
          userId,
          name,
          type,
          rarity,
          level: 1,
          experience: 0,
          expToNext: 100,
          attackBonus: Math.floor(Math.random() * 5) + 2,
          defenseBonus: Math.floor(Math.random() * 5) + 2,
          speedBonus: Math.floor(Math.random() * 5) + 2,
          isEquipped: false,
          equippedToId: null,
          equippedToType: null,
        });
        logs.push(`[Drop] Found ${rarity} ${name}!`);
      }

      await storage.updateUser(userId, {
        level: newLevel,
        experience: newExp,
        gold: user.gold + goldGained,
      });
      await giveEquipmentExp(userId, 10);
      
      res.json({ 
        victory, 
        experienceGained: expGained, 
        goldGained, 
        logs,
        equipmentDropped: droppedEquip ? [droppedEquip] : []
      });
    } else {
      logs.push("Defeat!");
      res.json({ victory, experienceGained: 0, goldGained: 0, logs });
    }
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const teamStats = await getPlayerTeamStats(userId);
    const enemy = generateEnemyStats('boss', user.level);

    // Skill Impacts
    let playerAtkMult = 1.0;
    let playerDefMult = 1.0;
    let enemyAtkMult = 1.0;

    const logs: string[] = [];
    logs.push(`You challenged ${enemy.name} (Lv${enemy.level}) at the Castle!`);

    if (teamStats) {
      teamStats.companions.forEach(c => {
        if ((c as any).skillType === 'passive') {
          if ((c as any).skillEffect === 'atk_buff') {
            const bonus = (c as any).skillValue;
            playerAtkMult += bonus / 100;
            logs.push(`[Skill] ${c.name}: Party Attack +${bonus}%`);
          }
          if ((c as any).skillEffect === 'def_buff') {
            const bonus = (c as any).skillValue;
            playerDefMult += bonus / 100;
            logs.push(`[Skill] ${c.name}: Party Defense +${bonus}%`);
          }
        }
      });
    }

    const finalPlayerAtk = Math.floor((teamStats?.player.attack || user.attack) * playerAtkMult);
    const finalEnemyAtk = Math.floor(enemy.attack * enemyAtkMult);

    const weather = user.weather || 'clear';
    const weatherEffect = WEATHER_EFFECTS[weather] || WEATHER_EFFECTS.clear;
    const weatherFinalPlayerAtk = Math.floor(finalPlayerAtk * weatherEffect.atkMod);

    logs.push(`[Weather] ${weatherEffect.name}: ${weatherEffect.description}`);
    logs.push(`[Combat] Player Siege Power: ${weatherFinalPlayerAtk} (Base: ${finalPlayerAtk})`);
    logs.push(`[Combat] Castle Defense Power: ${finalEnemyAtk}`);

    const roll = Math.floor(Math.random() * 50);
    logs.push(`[Combat] Battle Fortune: +${roll}`);

    const victory = weatherFinalPlayerAtk + roll > finalEnemyAtk;

    if (victory) {
      logs.push("The castle gates fall! Victory!");
      
      // Level up logic
      let newLevel = user.level;
      let newExp = user.experience + 100;
      let expToNext = user.level * 100;
      
      while (newExp >= expToNext) {
        newExp -= expToNext;
        newLevel++;
        expToNext = newLevel * 100;
        logs.push(`[Level Up] You reached Level ${newLevel}!`);
      }

      // Guaranteed equipment drop for Bosses
      const type = pick(EQUIP_TYPES);
      const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
      const rarity = 'blue'; // Bosses drop at least blue
      const droppedEquip = await storage.createEquipment({
        userId,
        name,
        type,
        rarity,
        level: 1,
        experience: 0,
        expToNext: 100,
        attackBonus: Math.floor(Math.random() * 10) + 5,
        defenseBonus: Math.floor(Math.random() * 10) + 5,
        speedBonus: Math.floor(Math.random() * 10) + 5,
        isEquipped: false,
        equippedToId: null,
        equippedToType: null,
      });
      logs.push(`[Drop] Found ${rarity} ${name} from the vault!`);

      await storage.updateUser(userId, { 
        level: newLevel,
        experience: newExp, 
        rice: user.rice + 10 
      });
      res.json({ 
        victory: true, 
        experienceGained: 100, 
        goldGained: 50, 
        riceGained: 10, 
        logs,
        equipmentDropped: [droppedEquip]
      });
    } else {
      logs.push("The siege failed... Retreat!");
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

    // Skill Impacts
    let playerAtkMult = 1.0;
    let playerDefMult = 1.0;
    let enemyAtkMult = 1.0;

    const logs: string[] = [];
    logs.push(`The sky turns dark... ${enemy.name} (Lv${enemy.level}) descends!`);

    if (teamStats) {
      teamStats.companions.forEach(c => {
        if ((c as any).skillType === 'passive') {
          if ((c as any).skillEffect === 'atk_buff') {
            const bonus = (c as any).skillValue;
            playerAtkMult += bonus / 100;
            logs.push(`[Skill] ${c.name}: Divine Attack +${bonus}%`);
          }
          if ((c as any).skillEffect === 'def_buff') {
            const bonus = (c as any).skillValue;
            playerDefMult += bonus / 100;
            logs.push(`[Skill] ${c.name}: Divine Defense +${bonus}%`);
          }
        }
      });
    }

    const finalPlayerAtk = Math.floor((teamStats?.player.attack || user.attack) * playerAtkMult);
    const finalEnemyAtk = Math.floor(enemy.attack * enemyAtkMult);

    const weather = user.weather || 'clear';
    const weatherEffect = WEATHER_EFFECTS[weather] || WEATHER_EFFECTS.clear;
    const weatherFinalPlayerAtk = Math.floor(finalPlayerAtk * weatherEffect.atkMod);

    logs.push(`[Weather] ${weatherEffect.name}: ${weatherEffect.description}`);
    logs.push(`[Combat] Total Heroic Power: ${weatherFinalPlayerAtk} (Base: ${finalPlayerAtk})`);
    logs.push(`[Combat] Calamity Power: ${finalEnemyAtk}`);

    const roll = Math.floor(Math.random() * 100);
    logs.push(`[Combat] Destiny Roll: +${roll}`);

    const victory = weatherFinalPlayerAtk + roll > finalEnemyAtk * 1.5;

    if (victory) {
      logs.push(`The legend is written! ${enemy.name} is sealed!`);
      
      // Level up logic
      let newLevel = user.level;
      let newExp = user.experience + 200;
      let expToNext = user.level * 100;
      
      while (newExp >= expToNext) {
        newExp -= expToNext;
        newLevel++;
        expToNext = newLevel * 100;
        logs.push(`[Level Up] You reached Level ${newLevel}!`);
      }

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

      // Special Boss drops 2 pieces of high quality equipment
      const drops = [];
      for (let i = 0; i < 2; i++) {
        const type = pick(EQUIP_TYPES);
        const name = pick(type === 'weapon' ? WEAPON_NAMES : type === 'armor' ? ARMOR_NAMES : type === 'accessory' ? ACCESSORY_NAMES : HORSE_GEAR_NAMES);
        const rarity = pick(['purple', 'gold']);
        const drop = await storage.createEquipment({
          userId,
          name,
          type,
          rarity,
          level: 1,
          experience: 0,
          expToNext: 100,
          attackBonus: Math.floor(Math.random() * 20) + 15,
          defenseBonus: Math.floor(Math.random() * 20) + 15,
          speedBonus: Math.floor(Math.random() * 20) + 15,
          isEquipped: false,
          equippedToId: null,
          equippedToType: null,
        });
        drops.push(drop);
        logs.push(`[Drop] Found legendary ${rarity} ${name}!`);
      }

      await storage.updateUser(userId, { 
        level: newLevel,
        experience: newExp, 
        gold: user.gold + 100 
      });
      res.json({ 
        victory: true, 
        transformationDropped: trans, 
        logs, 
        experienceGained: 200, 
        goldGained: 100,
        equipmentDropped: drops
      });
    } else {
      logs.push("The divine presence was too strong... Retreat!");
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
        logs.push("You supported the Oda clan in Owari. Your loyalty is rewarded with gold and a new strategist.");
        await storage.updateUser(userId, { gold: user.gold + 500 });
        reward = { type: 'gold', amount: 500 };
        
        // Add a special companion for Onin War (Nobunaga path)
        await storage.createCompanion({
          userId,
          name: "Young Nobunaga",
          type: 'historical',
          rarity: 5,
          level: 1,
          hp: 120,
          maxHp: 120,
          attack: 35,
          defense: 25,
          speed: 30,
          skill: "Ambition's Fire",
          skillType: "passive",
          skillEffect: "atk_buff",
          skillValue: 25,
          isInParty: false,
        });
      } else {
        logs.push("You chose to walk your own path. Your independence strengthens your resolve.");
        await storage.updateUser(userId, { defense: user.defense + 5 });
        reward = { type: 'stat', stat: 'defense', amount: 5 };
      }
    } else if (eventKey === 'honnoji') {
        if (choice === 'rescue') {
            logs.push("You fought through the fire to save the Lord. Your bravery is legendary.");
            await storage.updateUser(userId, { attack: user.attack + 15, hp: user.hp + 50 });
            reward = { type: 'stat', stat: 'attack/hp', amount: '15/50' };
            
            // Add a loyal guard for Honnoji Rescue
            await storage.createCompanion({
              userId,
              name: "Mori Ranmaru",
              type: 'historical',
              rarity: 4,
              level: 1,
              hp: 150,
              maxHp: 150,
              attack: 25,
              defense: 30,
              speed: 40,
              skill: "Shadow Guard",
              skillType: "passive",
              skillEffect: "def_buff",
              skillValue: 20,
              isInParty: false,
            });
        } else {
            logs.push("You joined the rebellion. Your cunning grows as you navigate the chaos.");
            await storage.updateUser(userId, { speed: user.speed + 10, gold: user.gold + 300 });
            reward = { type: 'stat', stat: 'speed/gold', amount: '10/300' };
        }
    } else if (eventKey === 'yokai_random') {
        if (choice === 'ally') {
            logs.push("You formed an alliance with the fox spirit. It grants you its power.");
            await storage.updateUser(userId, { speed: user.speed + 5 });
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
            logs.push("You rejected the spirit's offer. The experience hardens your soul.");
            await storage.updateUser(userId, { experience: user.experience + 50 });
            reward = { type: 'exp', amount: 50 };
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
    
    const pool = [
      { name: "Oda Nobunaga", skill: "Innovative Fire", skillType: "passive", skillEffect: "atk_buff", skillValue: 20 },
      { name: "Toyotomi Hideyoshi", skill: "Monkey's Scheme", skillType: "active", skillEffect: "spd_debuff", skillValue: 25 },
      { name: "Tokugawa Ieyasu", skill: "Turtle Shield", skillType: "passive", skillEffect: "def_buff", skillValue: 15 },
    ];
    const rolled = pick(pool);

    const companion = await storage.createCompanion({
      userId,
      name: rolled.name,
      type: 'historical',
      rarity: 5,
      level: 1,
      hp: 100,
      maxHp: 100,
      attack: 20,
      defense: 20,
      speed: 15,
      skill: rolled.skill,
      skillType: rolled.skillType,
      skillEffect: rolled.skillEffect,
      skillValue: rolled.skillValue,
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
    const equipment = await storage.createEquipment({
      userId,
      name: "Legendary Sword",
      type: 'weapon',
      rarity: 'gold',
      level: 1,
      experience: 0,
      expToNext: 100,
      attackBonus: 50,
      defenseBonus: 0,
      speedBonus: 0,
    });
    res.json({ equipment });
  });

  return httpServer;
}
