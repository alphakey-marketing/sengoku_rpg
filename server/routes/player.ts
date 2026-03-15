import { Router } from "express";
import { storage } from "../storage";
import { getPlayerTeamStats } from "../lib/player-stats";
import { api } from "@shared/routes";
import { statUpgradeCost, totalUpgradeCost } from "@shared/stat-cost";

export const playerRouter = Router();

// GET /api/player
playerRouter.get("/", async (req: any, res) => {
  try {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user) return res.status(404).json({ message: "Player not found" });
    res.json(user);
  } catch (err) {
    console.error("[player GET /]", err);
    res.status(500).json({ message: "Failed to load player", error: String(err) });
  }
});

// GET /api/player/status
playerRouter.get("/status", async (req: any, res) => {
  try {
    const team = await getPlayerTeamStats(req.user.claims.sub);
    if (!team) return res.status(404).json({ message: "Player not found" });
    res.json(team);
  } catch (err) {
    console.error("[player GET /status]", err);
    res.status(500).json({ message: "Failed to load player status", error: String(err) });
  }
});

// POST /api/player/mark-intro-seen
playerRouter.post("/mark-intro-seen", async (req: any, res) => {
  try {
    await storage.updateUser(req.user.claims.sub, { hasSeenIntro: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("[mark-intro-seen]", err);
    res.status(500).json({ message: String(err) });
  }
});

// POST /api/player/stats/upgrade  (single stat, single increment)
playerRouter.post("/stats/upgrade", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { stat } = req.body;
  const valid = ["str", "agi", "vit", "int", "dex", "luk"];
  if (!valid.includes(stat)) return res.status(400).json({ message: "Invalid stat" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  const cur  = (user as any)[stat] || 1;
  if (cur >= 99) return res.status(400).json({ message: "Stat already at maximum" });
  const cost = statUpgradeCost(cur);
  if (user.statPoints < cost) return res.status(400).json({ message: "Not enough stat points" });
  await storage.updateUser(userId, { [stat]: cur + 1, statPoints: user.statPoints - cost });
  res.json({ success: true, newValue: cur + 1, pointsUsed: cost });
});

// POST /api/player/stats/bulk-upgrade
playerRouter.post("/stats/bulk-upgrade", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { upgrades } = req.body;
  const valid = ["str", "agi", "vit", "int", "dex", "luk"];
  const user  = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  let totalCost = 0;
  const updates: Record<string, number> = {};

  for (const [stat, amount] of Object.entries(upgrades as Record<string, number>)) {
    if (!valid.includes(stat)) return res.status(400).json({ message: `Invalid stat: ${stat}` });
    const val = (user as any)[stat] || 1;
    if (val + amount > 99) return res.status(400).json({ message: `${stat} would exceed max` });
    const cost = totalUpgradeCost(val, amount);
    totalCost += cost;
    updates[stat] = val + amount;
  }

  if (user.statPoints < totalCost) {
    return res.status(400).json({
      message: "Not enough stat points",
      required: totalCost,
      available: user.statPoints,
    });
  }

  updates.statPoints = user.statPoints - totalCost;
  await storage.updateUser(userId, updates);
  res.json({ success: true, pointsUsed: totalCost });
});

// POST /api/restart
export async function restartHandler(req: any, res: any) {
  const userId = req.user.claims.sub;
  await (storage as any).restartGame(userId);
  await storage.createEquipment({
    userId, name: "Training Sword", type: "Weapon", weaponType: "sword",
    rarity: "white", level: 1, attackBonus: 10, isEquipped: true,
  });
  res.json({ success: true });
}
