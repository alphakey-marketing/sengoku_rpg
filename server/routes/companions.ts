import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { COMPANION_RARITY_GROWTH } from "../constants/rarityGrowth";

export function registerCompanionRoutes(app: Express) {
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
    const selected = allComps.filter(c => companionIds.includes(c.id));
    const names    = selected.map(c => c.name);
    if (new Set(names).size !== names.length) {
      return res.status(400).json({ message: "Cannot deploy the same warrior twice" });
    }
    for (const comp of allComps) {
      const shouldBeInParty = companionIds.includes(comp.id);
      if (comp.isInParty !== shouldBeInParty) {
        await storage.updateCompanion(comp.id, { isInParty: shouldBeInParty });
      }
    }
    res.json(await storage.getCompanions(userId));
  });

  app.post("/api/companions/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const comps  = await storage.getCompanions(userId);
    const target = comps.find(c => c.id === compId);
    if (!target)          return res.status(404).json({ message: "Companion not found" });
    if (target.isInParty) return res.status(400).json({ message: "Cannot dismiss active party member" });
    const raritySouls: Record<string, number> = { "1": 5, "2": 10, "3": 25, "4": 50, "5": 125 };
    const soulsGained = raritySouls[target.rarity] || 5;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    await storage.updateUser(userId, { warriorSouls: (user.warriorSouls || 0) + soulsGained });
    await storage.deleteCompanion(compId);
    res.json({ soulsGained });
  });

  app.post("/api/companions/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const compId = Number(req.params.id);
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.warriorSouls || 0) < 10) return res.status(400).json({ message: "Not enough Warrior Souls" });
    const allComps = await storage.getCompanions(userId);
    const comp     = allComps.find(c => c.id === compId);
    if (!comp) return res.status(404).json({ message: "Companion not found" });
    await storage.updateUser(userId, { warriorSouls: user.warriorSouls - 10 });

    let newExp       = comp.experience + 50;
    let newLevel     = comp.level;
    let newExpToNext = comp.expToNext;
    let hp = comp.hp, maxHp = comp.maxHp;
    let atk = comp.attack, def = comp.defense, spd = comp.speed;

    const growth       = COMPANION_RARITY_GROWTH[comp.rarity] ?? COMPANION_RARITY_GROWTH["1"];
    const specialBonus = (comp as any).isSpecial ? 1.25 : 1.0;

    while (newExp >= newExpToNext) {
      newExp       -= newExpToNext;
      newLevel++;
      newExpToNext  = Math.floor(100 * Math.pow(1.3, newLevel - 1));
      maxHp = Math.floor(maxHp * growth.hp * specialBonus) + 10;
      hp    = maxHp;
      atk   = Math.floor(atk  * growth.atk * specialBonus) + 3;
      def   = Math.floor(def  * growth.def * specialBonus) + 3;
      spd   = Math.floor(spd  * growth.spd * specialBonus) + 2;
    }

    res.json(await storage.updateCompanion(comp.id, {
      experience: newExp, level: newLevel, expToNext: newExpToNext,
      hp, maxHp, attack: atk, defense: def, speed: spd,
    }));
  });
}
