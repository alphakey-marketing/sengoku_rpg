import { Router } from "express";
import { storage } from "../storage";
import { getPlayerFlagMap } from "../lib/flag-map";
import { evalUnlockCondition, unlockConditionHint } from "@shared/schema";

export const companionsRouter = Router();

// GET /api/companions
companionsRouter.get("/", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const raw    = await storage.getCompanions(userId);

  const needsFlags = raw.some((c: any) => c.flagUnlockCondition);
  const flagMap    = needsFlags ? await getPlayerFlagMap(userId) : {};

  const companions = raw.map((c: any) => {
    const condition: string | null = c.flagUnlockCondition ?? null;
    const { flagUnlockCondition: _stripped, ...rest } = c;
    if (!condition) return { ...rest, isLocked: false, lockReason: null };
    const unlocked = evalUnlockCondition(condition, flagMap);
    return {
      ...rest,
      isLocked:   !unlocked,
      lockReason: unlocked ? null : unlockConditionHint(condition, flagMap),
    };
  });
  res.json(companions);
});

// POST /api/companions/party
companionsRouter.post("/party", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { companionIds } = req.body;
  if (!Array.isArray(companionIds))  return res.status(400).json({ message: "companionIds must be an array" });
  if (companionIds.length > 3)       return res.status(400).json({ message: "Maximum 3 companions in party" });

  const all     = await storage.getCompanions(userId);
  const flagMap = await getPlayerFlagMap(userId);
  for (const id of companionIds) {
    const comp = all.find((c: any) => c.id === id) as any;
    if (!comp) continue;
    if (comp.flagUnlockCondition && !evalUnlockCondition(comp.flagUnlockCondition, flagMap)) {
      return res.status(403).json({
        message: `${comp.name} is loyalty-locked: ${unlockConditionHint(comp.flagUnlockCondition, flagMap)}`,
      });
    }
  }
  const names = all.filter((c: any) => companionIds.includes(c.id)).map((c: any) => c.name);
  if (new Set(names).size !== names.length) return res.status(400).json({ message: "Duplicate companion names not allowed" });
  await storage.updateParty(userId, companionIds);
  res.json({ success: true });
});

// POST /api/companions/:id/recycle
companionsRouter.post("/:id/recycle", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const compId = Number(req.params.id);
  const all    = await storage.getCompanions(userId);
  const comp   = all.find((c: any) => c.id === compId) as any;
  if (!comp || comp.userId !== userId) return res.status(404).json({ message: "Companion not found" });
  if (comp.isInParty)                  return res.status(400).json({ message: "Cannot dismiss a companion in your active party" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  await storage.deleteCompanion(compId);
  await storage.updateUser(userId, { warriorSouls: (user.warriorSouls || 0) + 3 });
  res.json({ success: true, soulsGained: 3 });
});

// POST /api/companions/:id/upgrade
companionsRouter.post("/:id/upgrade", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const compId = Number(req.params.id);
  const user   = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if ((user.warriorSouls || 0) < 10) return res.status(400).json({ message: "Not enough Warrior Souls (need 10)" });
  const all  = await storage.getCompanions(userId);
  const comp = all.find((c: any) => c.id === compId) as any;
  if (!comp || comp.userId !== userId) return res.status(404).json({ message: "Companion not found" });
  await storage.updateCompanion(compId, {
    level:   (comp.level   || 1)  + 1,
    attack:  (comp.attack  || 10) + 5,
    defense: (comp.defense || 5)  + 2,
    speed:   (comp.speed   || 10) + 1,
    maxHp:   (comp.maxHp   || 50) + 10,
  });
  await storage.updateUser(userId, { warriorSouls: user.warriorSouls - 10 });
  res.json({ success: true });
});
