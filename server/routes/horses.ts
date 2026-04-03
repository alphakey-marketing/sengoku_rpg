import { Router } from "express";
import { storage } from "../storage";

export const horsesRouter = Router();

horsesRouter.get("/", async (req: any, res) => {
  res.json(await storage.getHorses(req.user.claims.sub));
});

horsesRouter.post("/:id/activate", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const horseId = Number(req.params.id);
  for (const h of await storage.getHorses(userId)) await storage.updateHorse(h.id, { isActive: false });
  await storage.updateHorse(horseId, { isActive: true });
  res.json({ success: true });
});

horsesRouter.post("/:id/deactivate", async (req: any, res) => {
  await storage.updateHorse(Number(req.params.id), { isActive: false });
  res.json({ success: true });
});

horsesRouter.post("/:id/recycle", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const horseId = Number(req.params.id);
  const all     = await storage.getHorses(userId);
  const horse   = all.find(h => h.id === horseId);
  if (!horse || horse.userId !== userId) return res.status(404).json({ message: "Horse not found" });
  if (horse.isActive) return res.status(400).json({ message: "Cannot recycle your active horse" });
  await storage.deleteHorse(horseId);
  const goldGained = 20;
  const user = await storage.getUser(userId);
  if (user) await storage.updateUser(userId, { gold: user.gold + goldGained });
  res.json({ success: true, goldGained });
});

horsesRouter.post("/combine", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { horseIds } = req.body;
  if (!Array.isArray(horseIds) || horseIds.length < 2) return res.status(400).json({ message: "Need at least 2 horses" });
  const all      = await storage.getHorses(userId);
  const selected = all.filter(h => horseIds.includes(String(h.id)) || horseIds.includes(h.id));
  if (selected.length < 2) return res.status(400).json({ message: "Horses not found" });
  const base      = selected[0];
  const rarities  = ["white","green","blue","purple","orange","red","gold","exotic","transcendent","celestial"];
  const idx       = rarities.indexOf(base.rarity);
  const upgraded  = Math.random() < 0.3;
  const newRarity = rarities[upgraded && idx < rarities.length - 1 ? idx + 1 : idx];
  for (const id of horseIds) await storage.deleteHorse(Number(id));
  const newHorse = await storage.createHorse({
    userId, name: base.name, rarity: newRarity,
    speedBonus:   base.speedBonus + (upgraded ? 5 : 2),
    attackBonus:  base.attackBonus,
    defenseBonus: base.defenseBonus,
    skill: base.skill, isActive: false,
  });
  res.json({ success: true, upgraded, newHorse });
});
