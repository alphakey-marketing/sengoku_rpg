import { Router } from "express";
import { storage } from "../storage";
import { runTurnBasedCombat, applyFlagModifiers } from "../combat";
import { getPlayerTeamStats, giveEquipmentExp } from "../lib/player-stats";
import { generateEnemyStats, generateEquipment, pick } from "../lib/enemy-gen";
import { api } from "@shared/routes";

export const battleRouter = Router();

// ── Field skirmish ────────────────────────────────────────────────────────────
battleRouter.post("/field", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const locationId  = Number(req.body.locationId)  || 1;
    const repeatCount = Math.min(Math.max(1, Number(req.body.repeatCount) || 1), 10);
    const teamStats   = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    let totalExp      = 0;
    let totalGold     = 0;
    let overallVictory = false;  // FIX B: use a proper boolean accumulator
    const allLogs: string[] = [];
    const dropped: any[]    = [];
    let ninjaEncounter: any = null;

    for (let i = 0; i < repeatCount; i++) {
      if (repeatCount > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);

      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        const names = locationId >= 100
          ? ["Zhuge Liang (Ghost)","Lu Bu's Spirit","Empress Wu Zetian"]
          : ["Hattori Hanzo","Fuma Kotaro","Ishikawa Goemon","Mochizuki Chiyome"];
        const lvl    = locationId >= 100 ? 7 + (locationId - 100) : locationId;
        const strong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        ninjaEncounter = {
          name: pick(names), level: strong ? lvl + 20 : lvl + 2,
          hp: strong ? 5000 : 1000, maxHp: strong ? 5000 : 1000,
          attack: strong ? 500 : 100, defense: strong ? 300 : 50, speed: strong ? 200 : 80,
          weaponType: "sword", str:20, agi:20, vit:20, int:10, dex:20, luk:10,
          weaponATK: strong ? 500 : 100, weaponLevel:3, hardDEF:50, softDEF:0,
          hit:220, flee:150, skills:["Shadow Strike","Vanish"], statusEffects: [],
        };
        allLogs.push(`A famous warrior, ${ninjaEncounter.name}, blocks your path!`);
        break;
      }

      const enemy = generateEnemyStats("field", user.level, locationId);
      if (i === 0 && req.body.enemyName) enemy.name = req.body.enemyName;

      const modLogs = await applyFlagModifiers(userId, teamStats, [enemy]);
      allLogs.push(...modLogs);
      const result = runTurnBasedCombat(teamStats, [enemy]);
      allLogs.push(...(result.logs || []));

      // FIX B: accumulate victory from the typed boolean, not string scanning
      if (result.victory) {
        overallVictory = true;
        await storage.updateQuestProgress(userId, "daily_skirmish",       1);
        await storage.updateQuestProgress(userId, "daily_skirmish_elite", 1);
        const exp  = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const gold = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExp  += exp;
        totalGold += gold;

        let xp = user.experience + totalExp;
        let lv = user.level, mhp = user.maxHp, sp = user.statPoints;
        while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; }
        await storage.updateUser(userId, { experience: xp, level: lv, maxHp: mhp, statPoints: sp, gold: user.gold + totalGold });

        if (Math.random() < 0.01) {
          try { dropped.push(await storage.createEquipment(generateEquipment(userId, locationId))); } catch {}
        }
      }
    }

    await giveEquipmentExp(userId, totalExp);
    res.json({
      victory: overallVictory,
      logs: allLogs, expGained: totalExp, goldGained: totalGold,
      equipmentDropped: dropped, ninjaEncounter,
    });
  } catch (err) {
    // FIX A: surface real server errors as JSON so the client catch block
    // can distinguish a network failure from a battle-server error.
    console.error("[battle/field] unhandled error:", err);
    res.status(500).json({ message: "Battle server error", error: String(err) });
  }
});

// ── Ninja battle ──────────────────────────────────────────────────────────────
battleRouter.post("/ninja", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const { ninjaStats } = req.body;
  if (!ninjaStats) return res.status(400).json({ message: "ninjaStats required" });
  const team = await getPlayerTeamStats(userId);
  if (!team) return res.status(400).json({ message: "Team not found" });
  if (!(ninjaStats as any).statusEffects) (ninjaStats as any).statusEffects = [];
  const modLogs = await applyFlagModifiers(userId, team, [ninjaStats]);
  const result  = runTurnBasedCombat(team, [ninjaStats]);
  if (result.victory) {
    await storage.updateUser(userId, {
      experience:   user.experience + 100,
      gold:         user.gold + 50,
      warriorSouls: (user.warriorSouls || 0) + 1,
    });
  }
  res.json({ victory: result.victory, logs: [...modLogs, ...(result.logs || [])] });
});

// ── Boss battle ───────────────────────────────────────────────────────────────
battleRouter.post("/boss", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const { locationId: rawLoc, goldDemanded } = req.body;
  const locationId = Number(rawLoc) || 1;
  if (!goldDemanded)            return res.status(400).json({ message: "goldDemanded required" });
  if (user.gold < goldDemanded) return res.status(400).json({ message: "Not enough gold" });
  await storage.updateUser(userId, { gold: user.gold - goldDemanded });
  const team  = await getPlayerTeamStats(userId);
  if (!team) return res.status(400).json({ message: "Team not found" });
  const enemy = generateEnemyStats("boss", user.level, locationId);
  const modLogs = await applyFlagModifiers(userId, team, [enemy]);
  const result  = runTurnBasedCombat(team, [enemy]);
  if (result.victory) {
    await storage.updateUser(userId, {
      gold:            user.gold - goldDemanded + goldDemanded * 2,
      endowmentStones: (user.endowmentStones || 0) + 3 + Math.floor(Math.random() * 3),
    });
    await storage.updateQuestProgress(userId, "daily_boss", 1);
  }
  res.json({ victory: result.victory, logs: [...modLogs, ...(result.logs || [])], enemy });
});

// ── Campaign battle ───────────────────────────────────────────────────────────
battleRouter.post("/campaign", async (req: any, res) => {
  const userId     = req.user.claims.sub;
  const user       = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const locationId = Number(req.body.locationId) || 1;
  const team       = await getPlayerTeamStats(userId);
  if (!team) return res.status(400).json({ message: "Team not found" });
  const enemy   = generateEnemyStats("boss", user.level, locationId);
  const modLogs = await applyFlagModifiers(userId, team, [enemy]);
  const result  = runTurnBasedCombat(team, [enemy]);
  if (result.victory) {
    const exp   = 100 + locationId * 50;
    const gold  = 50  + locationId * 25;
    const rice  = 10  + locationId * 5;
    const eStones = 2 + Math.floor(Math.random() * 3);
    let xp = user.experience + exp, lv = user.level, mhp = user.maxHp, sp = user.statPoints, spd = user.speed;
    while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; spd += 2; }
    await storage.updateUser(userId, {
      level: lv, experience: xp, maxHp: mhp, statPoints: sp, speed: spd,
      gold: user.gold + gold, rice: (user.rice || 0) + rice,
      endowmentStones: (user.endowmentStones || 0) + eStones,
      currentLocationId: Math.max(user.currentLocationId || 1, locationId),
    });
    const eqDrop: any[] = [];
    if (Math.random() < 0.05) {
      try { eqDrop.push(await storage.createEquipment(generateEquipment(userId, locationId, true))); } catch {}
    }
    return res.json({ victory: true, logs: [...modLogs, ...(result.logs || [])], expGained: exp, goldGained: gold, riceGained: rice, equipmentDropped: eqDrop, petDropped: null });
  }
  res.json({ victory: false, logs: [...modLogs, ...(result.logs || [])], expGained: 0, goldGained: 0, riceGained: 0, equipmentDropped: [], petDropped: null });
});

// ── Special boss battle ───────────────────────────────────────────────────────
battleRouter.post("/special-boss", async (req: any, res) => {
  const userId     = req.user.claims.sub;
  const user       = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const locationId = Number(req.body.locationId) || 1;
  const team       = await getPlayerTeamStats(userId);
  if (!team) return res.status(400).json({ message: "Team not found" });
  const enemy   = generateEnemyStats("special", user.level, locationId);
  const modLogs = await applyFlagModifiers(userId, team, [enemy]);
  const result  = runTurnBasedCombat(team, [enemy]);
  if (result.victory) {
    const exp   = 250 + locationId * 100;
    const gold  = 150 + locationId * 75;
    const eStones = 5 + Math.floor(Math.random() * 6);
    let xp = user.experience + exp, lv = user.level, mhp = user.maxHp, sp = user.statPoints, spd = user.speed;
    while (xp >= lv * 100) { xp -= lv * 100; lv++; mhp += 10; sp += 3; spd += 2; }
    await storage.updateUser(userId, {
      level: lv, experience: xp, maxHp: mhp, statPoints: sp, speed: spd,
      gold: user.gold + gold, endowmentStones: (user.endowmentStones || 0) + eStones,
    });
    return res.json({ victory: true, logs: [...modLogs, ...(result.logs || [])], expGained: exp });
  }
  res.json({ victory: false, logs: [...modLogs, ...(result.logs || [])], expGained: 0 });
});
