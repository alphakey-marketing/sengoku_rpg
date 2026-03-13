import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { runTurnBasedCombat } from "../combat";
import { getPlayerTeamStats } from "../helpers/teamStats";
import { applyExpGain } from "../helpers/levelUp";
import { giveEquipmentExp } from "../helpers/equipmentExp";
import { generateEquipment, generateEnemyStats, generateNinjaStats } from "../generators/entities";
import { SPECIAL_BOSSES } from "../constants/enemies";
import { pick } from "../utils";
import { getFlagModifiers, applyFlagModifiers } from "../helpers/storyFlagModifiers";

export function registerBattleRoutes(app: Express) {
  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId)  || 1;
    const rawCount   = Math.min(Math.max(1, Number(req.body.repeatCount) || 1), 10);

    const [teamStats, flagMods] = await Promise.all([
      getPlayerTeamStats(userId),
      getFlagModifiers(userId),
    ]);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    // Apply story flag modifiers to combat stats
    applyFlagModifiers(teamStats, flagMods);

    // Political power can thin the enemy ranks (min 1 battle)
    const count = Math.max(1, rawCount - flagMods.enemyReduction);

    let totalExpGained   = 0;
    let totalGoldGained  = 0;
    const allEquipmentDropped: any[] = [];
    const allPetsDropped:      any[] = [];
    const allHorsesDropped:    any[] = [];
    // Prepend flag modifier log lines so player sees them first
    const allLogs: string[] = [...flagMods.logLines];
    let ninjaEncounter: any = null;

    for (let i = 0; i < count; i++) {
      if (count > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);

      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        const ninjaNames = locationId >= 100
          ? ["Zhuge Liang (Ghost)", "Lu Bu's Spirit", "Empress Wu Zetian"]
          : ["Hattori Hanzo", "Fuma Kotaro", "Ishikawa Goemon", "Mochizuki Chiyome"];
        const ninjaName     = pick(ninjaNames);
        const isSuperStrong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        ninjaEncounter = generateNinjaStats(
          ninjaName, locationId, isSuperStrong,
          Math.floor(user.gold * 0.1),
        );
        allLogs.push(`A famous ninja, ${ninjaName}, blocks your path!`);
        break;
      }

      const enemy = generateEnemyStats('field', user.level, locationId);
      if (i === 0 && req.body.enemyName) enemy.name = req.body.enemyName;
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      allLogs.push(...battleResult.logs);

      if (battleResult.victory) {
        await storage.updateQuestProgress(userId, 'daily_skirmish', 1);
        await storage.updateQuestProgress(userId, 'daily_skirmish_elite', 1);
        const expGained  = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const goldGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExpGained  += expGained;
        totalGoldGained += goldGained;
        if (Math.random() < 0.01) {
          try {
            const eq = await storage.createEquipment(generateEquipment(userId, locationId) as any);
            allEquipmentDropped.push(eq);
            allLogs.push(`Found ${eq.rarity.toUpperCase()} ${eq.name}!`);
          } catch (err) { console.error("Equipment drop failed:", err); }
        }
      }
    }

    if (totalExpGained > 0) {
      const freshUser = await storage.getUser(userId);
      if (freshUser) {
        const leveled              = applyExpGain(freshUser, totalExpGained);
        const endowmentStoneGained = Math.random() < 0.2 ? 1 : 0;
        const talismanGained       = Math.random() < 0.05 ? 1 : 0;
        await storage.updateUser(userId, {
          ...leveled,
          gold:            freshUser.gold + totalGoldGained,
          hp:              leveled.maxHp,
          endowmentStones: (freshUser.endowmentStones || 0) + endowmentStoneGained,
          fireGodTalisman: (freshUser.fireGodTalisman  || 0) + talismanGained,
        });
      }
    }
    await giveEquipmentExp(userId, totalExpGained);

    res.json({
      victory:          totalExpGained > 0,
      experienceGained: totalExpGained,
      goldGained:       totalGoldGained,
      equipmentDropped: allEquipmentDropped,
      petDropped:       allPetsDropped[0]   || null,
      allPetsDropped,
      horseDropped:     allHorsesDropped[0] || null,
      allHorsesDropped,
      logs:             allLogs,
      ninjaEncounter,
    });
  });

  app.post("/api/battle/ninja/resolve", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { action, ninjaName, goldDemanded, locationId = 1 } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (action === 'pay') {
      const goldToPay = Math.floor(Number(goldDemanded));
      if ((Number(user.gold) || 0) < goldToPay) {
        return res.status(400).json({ message: `Not enough gold. You have ${user.gold}, but ${goldToPay} is required.` });
      }
      await storage.updateUser(userId, { gold: user.gold - goldToPay });
      return res.json({ success: true, message: `You paid ${goldToPay} gold to ${ninjaName}. He vanished into the shadows.` });
    }

    const [teamStats, flagMods] = await Promise.all([
      getPlayerTeamStats(userId),
      getFlagModifiers(userId),
    ]);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    applyFlagModifiers(teamStats, flagMods);

    const isSuperStrong = Math.random() < 0.3;
    const enemy         = generateNinjaStats(ninjaName, Number(locationId), isSuperStrong, goldDemanded);
    const battleResult  = runTurnBasedCombat(teamStats, [enemy]);
    // Prepend flag log lines
    battleResult.logs.unshift(...flagMods.logLines);
    if (battleResult.victory) {
      const goldGained   = goldDemanded * 2;
      const stonesGained = 3 + Math.floor(Math.random() * 3);
      await storage.updateUser(userId, {
        gold:            user.gold + goldGained,
        endowmentStones: (user.endowmentStones || 0) + stonesGained,
      });
      battleResult.logs.push(`You defeated ${ninjaName} and looted ${goldGained} gold and ${stonesGained} Endowment Stones!`);
    }
    res.json({ success: true, battleResult });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;

    const [teamStats, flagMods] = await Promise.all([
      getPlayerTeamStats(userId),
      getFlagModifiers(userId),
    ]);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    applyFlagModifiers(teamStats, flagMods);

    const enemyData  = generateEnemyStats('boss', user.level, locationId);
    if (req.body.enemyName) enemyData.name = req.body.enemyName;
    const { victory, logs } = runTurnBasedCombat(teamStats, [enemyData]);
    logs.unshift(...flagMods.logLines);

    if (victory) {
      await storage.updateQuestProgress(userId, 'daily_boss', 1);
      const expGained       = 100 + locationId * 50;
      const goldGained      = 50  + locationId * 25;
      const riceGained      = 10  + locationId * 5;
      const endowmentStones = 2   + Math.floor(Math.random() * 3);
      const leveled         = applyExpGain(user, expGained);
      await storage.updateUser(userId, {
        ...leveled,
        gold:            user.gold + goldGained,
        rice:            user.rice + riceGained,
        hp:              leveled.maxHp,
        endowmentStones: (user.endowmentStones || 0) + endowmentStones,
      });
      if (Math.random() < 0.05) {
        const eq = await storage.createEquipment(generateEquipment(userId, locationId, true) as any);
        return res.json({ victory: true, experienceGained: expGained, goldGained, riceGained, equipmentDropped: [eq], petDropped: null, logs });
      }
      return res.json({ victory: true, experienceGained: expGained, goldGained, riceGained, equipmentDropped: [], petDropped: null, logs });
    }
    logs.push("Defeat!");
    res.json({ victory: false, logs });
  });

  app.post(api.battle.specialBoss.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;

    const [teamStats, flagMods] = await Promise.all([
      getPlayerTeamStats(userId),
      getFlagModifiers(userId),
    ]);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    applyFlagModifiers(teamStats, flagMods);

    const enemyData  = generateEnemyStats('special', user.level, locationId);
    if (req.body.enemyName) enemyData.name = req.body.enemyName;
    const { victory, logs } = runTurnBasedCombat(teamStats, [enemyData]);
    logs.unshift(...flagMods.logLines);

    if (victory) {
      const expGained       = 250 + locationId * 100;
      const goldGained      = 150 + locationId * 75;
      const endowmentStones = 5   + Math.floor(Math.random() * 6);
      const leveled         = applyExpGain(user, expGained);
      await storage.updateUser(userId, {
        ...leveled,
        gold:                 user.gold + goldGained,
        hp:                   leveled.maxHp,
        endowmentStones:      (user.endowmentStones      || 0) + endowmentStones,
        transformationStones: (user.transformationStones || 0) + 10,
      });
      const sb    = pick(SPECIAL_BOSSES);
      const trans = await storage.createTransformation({
        userId,
        name:            sb.transformName,
        level:           1,
        experience:      0,
        expToNext:       200,
        attackPercent:   sb.atkPct,
        defensePercent:  sb.defPct,
        speedPercent:    sb.spdPct,
        hpPercent:       sb.hpPct,
        skill:           sb.skill,
        cooldownSeconds: 60,
        durationSeconds: 30,
      });
      return res.json({ victory: true, transformationDropped: trans, logs, experienceGained: expGained, goldGained });
    }
    logs.push("Defeat!");
    res.json({ victory: false, logs });
  });
}
