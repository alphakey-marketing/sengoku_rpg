import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";

export function registerStatsRoutes(app: Express) {
  app.post(api.stats.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const currentVal = (user as any)[stat] || 1;
    if (currentVal >= 99) return res.status(400).json({ message: "Stat already at maximum" });
    const cost = Math.floor((currentVal - 1) / 10) + 2;
    if ((user.statPoints || 0) < cost) {
      return res.status(400).json({ message: `Not enough stat points. Need ${cost}.` });
    }
    res.json(await storage.updateUser(userId, {
      statPoints: user.statPoints - cost,
      [stat]: currentVal + 1,
    }));
  });

  app.post(api.stats.bulkUpgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { upgrades } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    let currentStatPoints = user.statPoints || 0;
    const updates: any   = {};
    const VALID_STATS     = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
    for (const [stat, amount] of Object.entries(upgrades)) {
      if (!VALID_STATS.includes(stat)) continue;
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
    res.json(await storage.updateUser(userId, updates));
  });
}
