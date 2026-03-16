import { Router } from "express";
import { storage } from "../storage";
import { equipRarityFromRandom, generateEquipment, pick } from "../lib/enemy-gen";

export const gachaRouter = Router();

const COMPANION_TYPES  = ["Samurai","Ninja","Monk","Archer","Mage","Berserker","Strategist","Healer"];
const COMPANION_NAMES  = ["Takeshi","Yuki","Hiroshi","Sakura","Kenji","Akira","Ryu","Hana","Daichi","Mizuki"];

// ── Base stat ranges by companion type (M7 FIX) ───────────────────────────────
// Each gacha companion now spawns with all six base stats so combat
// formulas never receive undefined and produce NaN / 0 damage.
const TYPE_STAT_PROFILES: Record<string, { str: number[]; agi: number[]; vit: number[]; int: number[]; dex: number[]; luk: number[] }> = {
  Samurai:    { str:[12,20], agi:[8,14],  vit:[10,16], int:[4,8],   dex:[8,14],  luk:[6,10]  },
  Ninja:      { str:[8,14],  agi:[14,22], vit:[6,12],  int:[6,10],  dex:[12,20], luk:[10,16] },
  Monk:       { str:[10,16], agi:[8,14],  vit:[14,20], int:[8,14],  dex:[6,12],  luk:[8,12]  },
  Archer:     { str:[8,14],  agi:[12,18], vit:[8,14],  int:[6,10],  dex:[14,22], luk:[8,14]  },
  Mage:       { str:[4,8],   agi:[8,14],  vit:[6,12],  int:[16,24], dex:[8,14],  luk:[8,14]  },
  Berserker:  { str:[16,24], agi:[10,16], vit:[12,18], int:[2,6],   dex:[6,10],  luk:[4,8]   },
  Strategist: { str:[6,10],  agi:[10,16], vit:[8,14],  int:[14,22], dex:[10,16], luk:[10,16] },
  Healer:     { str:[4,8],   agi:[8,14],  vit:[12,18], int:[12,20], dex:[8,14],  luk:[12,18] },
};

function rollStat(range: number[]): number {
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

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

  const companionType = pick(COMPANION_TYPES);
  const profile = TYPE_STAT_PROFILES[companionType] ?? TYPE_STAT_PROFILES.Samurai;

  // M7 FIX: populate all six base stats so combat engine never receives undefined
  const companion = await storage.createCompanion({
    userId,
    name:    pick(COMPANION_NAMES),
    type:    companionType,
    rarity,
    level:   1,
    attack:  10 + Math.floor(Math.random() * 20),
    defense: 5  + Math.floor(Math.random() * 10),
    speed:   10 + Math.floor(Math.random() * 10),
    str: rollStat(profile.str),
    agi: rollStat(profile.agi),
    vit: rollStat(profile.vit),
    dex: rollStat(profile.dex),
    luk: rollStat(profile.luk),
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
