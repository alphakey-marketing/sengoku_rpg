import { Router } from "express";
import { storage } from "../storage";
import { equipRarityFromRandom, generateEquipment, pick } from "../lib/enemy-gen";

export const gachaRouter = Router();

const COMPANION_TYPES  = ["Samurai","Ninja","Monk","Archer","Mage","Berserker","Strategist","Healer"];
const COMPANION_NAMES  = ["Takeshi","Yuki","Hiroshi","Sakura","Kenji","Akira","Ryu","Hana","Daichi","Mizuki"];

gachaRouter.post("/pull", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const { isSpecial, count } = req.body;
  const pullCount   = Math.min(count || 1, 10);
  const costPerPull = isSpecial ? 300 : 100;
  if (user.gold < costPerPull * pullCount) return res.status(400).json({ message: "Not enough gold" });
  await storage.updateUser(userId, { gold: user.gold - costPerPull * pullCount });
  const rarity = isSpecial
    ? (() => { const r = Math.random(); return r > 0.85 ? "5" : r > 0.60 ? "4" : r > 0.30 ? "3" : "2"; })()
    : equipRarityFromRandom(1);
  const companion = await storage.createCompanion({
    userId, name: pick(COMPANION_NAMES), type: pick(COMPANION_TYPES), rarity, level: 1,
    attack:  10 + Math.floor(Math.random() * 20),
    defense: 5  + Math.floor(Math.random() * 10),
    speed:   10 + Math.floor(Math.random() * 10),
  });
  await storage.updateQuestProgress(userId, "daily_gacha",       1);
  await storage.updateQuestProgress(userId, "daily_gacha_elite", 1);
  res.json({ companion });
});

gachaRouter.post("/pull-equipment", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const pullCount = Math.min(req.body.count || 1, 10);
  if (user.gold < 50 * pullCount) return res.status(400).json({ message: "Not enough gold" });
  await storage.updateUser(userId, { gold: user.gold - 50 * pullCount });
  const results: any[] = [];
  for (let i = 0; i < pullCount; i++) results.push(await storage.createEquipment(generateEquipment(userId, 1)));
  res.json({ equipment: results });
});
