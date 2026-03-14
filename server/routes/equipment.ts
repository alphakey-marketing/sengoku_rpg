import { Router } from "express";
import { storage } from "../storage";
import { getPlayerFlagMap } from "../lib/flag-map";
import { evalUnlockCondition, unlockConditionHint } from "@shared/schema";

export const equipmentRouter = Router();

// ── Helper: strip raw column + inject computed lock fields ────────────────────────
function applyFlagLock(
  items: any[],
  flagMap: Record<string, number>,
): any[] {
  return items.map(item => {
    const condition: string | null = item.storyFlagRequirement ?? null;
    const { storyFlagRequirement: _stripped, ...rest } = item;
    if (!condition) return { ...rest, isLocked: false, lockReason: null };
    const unlocked = evalUnlockCondition(condition, flagMap);
    return {
      ...rest,
      isLocked:   !unlocked,
      lockReason: unlocked ? null : unlockConditionHint(condition, flagMap),
    };
  });
}

// GET /api/equipment
// Injects isLocked + lockReason; strips storyFlagRequirement from response.
equipmentRouter.get("/", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const raw    = await storage.getEquipment(userId);

  const needsFlags = raw.some((e: any) => e.storyFlagRequirement);
  const flagMap    = needsFlags ? await getPlayerFlagMap(userId) : {};

  res.json(applyFlagLock(raw, flagMap));
});

// POST /api/equipment/:id/equip
// Enforces story-flag lock: returns 403 if condition not yet met.
equipmentRouter.post("/:id/equip", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const equipId = Number(req.params.id);
  const { targetType, targetId } = req.body;
  const all  = await storage.getEquipment(userId);
  const item = all.find((e: any) => e.id === equipId) as any;
  if (!item) return res.status(404).json({ message: "Equipment not found" });

  // ── A3: enforce story-flag requirement ───────────────────────────────────────
  if (item.storyFlagRequirement) {
    const flagMap  = await getPlayerFlagMap(userId);
    const unlocked = evalUnlockCondition(item.storyFlagRequirement, flagMap);
    if (!unlocked) {
      return res.status(403).json({
        message: `This item is story-locked: ${unlockConditionHint(item.storyFlagRequirement, flagMap)}`,
      });
    }
  }

  const clash = all.find(
    (e: any) => e.isEquipped && e.type === item.type
      && e.equippedToType === (targetType || "player")
      && e.equippedToId   === (targetId   || null)
      && e.id             !== equipId,
  );
  if (clash) await storage.updateEquipment(clash.id, { isEquipped: false, equippedToType: null, equippedToId: null });
  await storage.updateEquipment(equipId, {
    isEquipped:     true,
    equippedToType: targetType || "player",
    equippedToId:   targetId   || null,
  });
  res.json({ success: true });
});

// POST /api/equipment/:id/unequip
equipmentRouter.post("/:id/unequip", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const equipId = Number(req.params.id);
  const all     = await storage.getEquipment(userId);
  if (!all.find((e: any) => e.id === equipId))
    return res.status(404).json({ message: "Equipment not found" });
  await storage.updateEquipment(equipId, { isEquipped: false, equippedToType: null, equippedToId: null });
  res.json({ success: true });
});

// POST /api/equipment/recycle  (bulk by IDs)
equipmentRouter.post("/recycle", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { equipmentIds } = req.body;
  if (!Array.isArray(equipmentIds) || equipmentIds.length === 0)
    return res.status(400).json({ message: "equipmentIds required" });
  let stonesGained = 0;
  for (const id of equipmentIds) {
    const all    = await storage.getEquipment(userId);
    const target = all.find((e: any) => e.id === Number(id));
    if (!target || target.userId !== userId || target.isEquipped) continue;
    const user = await storage.getUser(userId);
    if (!user) continue;
    await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + 5 });
    await storage.deleteEquipment(Number(id));
    stonesGained += 5;
  }
  res.json({ success: true, stonesGained });
});

// POST /api/equipment/recycle-rarity
equipmentRouter.post("/recycle-rarity", async (req: any, res) => {
  try {
    res.json(await storage.recycleEquipment(req.user.claims.sub));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/equipment/:id/upgrade
equipmentRouter.post("/:id/upgrade", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const equipId = Number(req.params.id);
  const all     = await storage.getEquipment(userId);
  const item    = all.find((e: any) => e.id === equipId);
  if (!item) return res.status(404).json({ message: "Equipment not found" });
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if ((user.upgradeStones || 0) < 1) return res.status(400).json({ message: "Not enough upgrade stones" });
  await storage.updateEquipment(equipId, {
    level:      (item.level     || 1) + 1,
    experience: 0,
    expToNext:  Math.floor((item.expToNext || 100) * 1.5),
  });
  await storage.updateUser(userId, { upgradeStones: user.upgradeStones - 1 });
  res.json({ success: true });
});

// POST /api/equipment/:id/endow
equipmentRouter.post("/:id/endow", async (req: any, res) => {
  const userId  = req.user.claims.sub;
  const equipId = Number(req.params.id);
  const { type, protect } = req.body;
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const all = await storage.getEquipment(userId);
  const eq  = all.find((e: any) => e.id === equipId);
  if (!eq) return res.status(404).json({ message: "Equipment not found" });
  if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });
  const cur         = (eq as any).endowmentPoints || 0;
  const baseRate    = type === "extreme" ? 0.7 : 0.9;
  const successRate = Math.max(0.1, baseRate - cur * 0.02);
  const success     = Math.random() < successRate;
  const stonesUsed  = protect && user.endowmentStones >= 2 ? 2 : 1;
  let newPoints     = cur;
  let pointsGained  = 0;
  if (success) {
    pointsGained = type === "extreme" ? 3 : 1;
    newPoints    = cur + pointsGained;
  } else if (stonesUsed === 1) {
    newPoints = Math.max(0, cur - 1);
  }
  await storage.updateEquipment(equipId, { endowmentPoints: newPoints });
  await storage.updateUser(userId, { endowmentStones: user.endowmentStones - stonesUsed });
  res.json({ success, pointsGained, newPoints, stonesUsed });
});

// POST /api/equipment/:id/insert-card
equipmentRouter.post("/:id/insert-card", async (req: any, res) => {
  const equipId = Number(req.params.id);
  const { cardId } = req.body;
  try {
    await storage.insertCardIntoEquipment(cardId, equipId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/cards (equipment-adjacent, mounted separately in routes.ts)
export const cardsRouter = Router();
cardsRouter.get("/", async (req: any, res) => {
  res.json(await storage.getCards(req.user.claims.sub));
});
