import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { getPlayerTeamStats } from "../helpers/teamStats";

export function registerPlayerRoutes(app: Express) {
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getUser(userId));
  });

  app.get(api.player.fullStatus.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(401).json({ message: "Unauthorized" });
    res.json(teamStats);
  });

  app.post("/api/player/exchange-stones", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.rice < 2000) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, {
      rice:            user.rice - 2000,
      endowmentStones: (user.endowmentStones || 0) + 1,
    });
    res.json({ success: true });
  });

  app.post("/api/restart", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await (storage as any).restartGame(userId);
    await storage.createEquipment({
      userId, name: "Training Sword", type: "weapon", weaponType: "sword",
      rarity: "white", level: 1, experience: 0, expToNext: 100,
      attackBonus: 5, defenseBonus: 0, speedBonus: 0, hpBonus: 0,
      mdefBonus: 0, fleeBonus: 0, matkBonus: 0, critChance: 5,
      critDamage: 0, endowmentPoints: 0,
      isEquipped: true, equippedToId: null, equippedToType: "player", cardSlots: 1,
    } as any);
    res.json({ success: true });
  });
}
