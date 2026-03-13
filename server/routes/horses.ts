import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { generateHorse } from "../generators/entities";
import { HORSE_RARITY_STATS, HORSE_NAMES } from "../constants/items";
import { pick } from "../utils";

export function registerHorseRoutes(app: Express) {
  app.get(api.horses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getHorses(userId));
  });

  app.post(api.horses.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const horseId   = Number(req.params.id);
    const allHorses = await storage.getHorses(userId);
    for (const h of allHorses) {
      if (h.isActive && h.id !== horseId) await storage.updateHorse(h.id, { isActive: false });
    }
    const horse = allHorses.find(h => h.id === horseId);
    if (!horse) return res.status(404).json({ message: "Horse not found" });
    res.json(await storage.updateHorse(horseId, { isActive: true }));
  });

  app.post(api.horses.recycle.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
    const horse   = await storage.getHorse(horseId);
    if (!horse || horse.userId !== userId) return res.status(404).json({ message: "Horse not found" });
    if (horse.isActive) return res.status(400).json({ message: "Cannot recycle active horse" });
    const rarityValues: Record<string, number> = {
      white: 10, green: 25, blue: 50, purple: 100, gold: 250,
      mythic: 500, exotic: 1000, transcendent: 2000, celestial: 4000, primal: 8000,
    };
    const goldGained = rarityValues[horse.rarity] || 10;
    await storage.deleteHorse(horseId);
    const user = await storage.getUser(userId);
    if (user) await storage.updateUser(userId, { gold: user.gold + goldGained });
    res.json({ goldGained });
  });

  app.post(api.horses.combine.path, isAuthenticated, async (req: any, res) => {
    const userId       = req.user.claims.sub;
    const { horseIds } = req.body;
    if (!horseIds || horseIds.length !== 3) {
      return res.status(400).json({ message: "Must provide exactly 3 horses" });
    }
    const horses = await Promise.all(horseIds.map((id: number) => storage.getHorse(id)));
    if (horses.some(h => !h || h.userId !== userId)) return res.status(400).json({ message: "Invalid horses" });
    if (horses.some(h => h!.isActive)) return res.status(400).json({ message: "Cannot combine active horses" });
    const baseRarity = horses[0]!.rarity;
    if (!horses.every(h => h!.rarity === baseRarity)) return res.status(400).json({ message: "All horses must be same rarity" });
    const rarityOrder  = ['white','green','blue','purple','gold','mythic','exotic','transcendent','celestial','primal'];
    const currentIndex = rarityOrder.indexOf(baseRarity);
    const upgraded     = Math.random() < 0.5;
    const newRarity    = rarityOrder[upgraded && currentIndex < rarityOrder.length - 1 ? currentIndex + 1 : currentIndex];
    for (const id of horseIds) await storage.deleteHorse(Number(id));
    const newHorse        = generateHorse(userId, 1);
    newHorse.rarity       = newRarity;
    newHorse.name         = `${newRarity.toUpperCase()} ${pick(HORSE_NAMES)}`;
    const stats           = HORSE_RARITY_STATS[newRarity] ?? HORSE_RARITY_STATS.white;
    const variance        = () => 0.9 + Math.random() * 0.2;
    newHorse.speedBonus   = Math.floor(stats.speed * variance());
    newHorse.attackBonus  = Math.floor(stats.atk   * variance());
    newHorse.defenseBonus = Math.floor(stats.def   * variance());
    const created = await storage.createHorse(newHorse as any);
    res.json({ success: true, newHorse: created, upgraded });
  });
}
