import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { calcEquipExpToNext } from "../helpers/levelUp";
import { EQUIP_RARITY_GROWTH } from "../constants/rarityGrowth";

export function registerEquipmentRoutes(app: Express) {
  app.get(api.equipment.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getEquipment(userId));
  });

  app.post(api.equipment.equip.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { equippedToId, equippedToType } = req.body;
    const equips      = await storage.getEquipment(userId);
    const targetEquip = equips.find(e => e.id === equipId);
    if (!targetEquip) return res.status(404).json({ message: "Equipment not found" });
    const sameTypeEquipped = equips.find(e =>
      e.id !== equipId && e.isEquipped && e.type === targetEquip.type &&
      e.equippedToType === equippedToType &&
      (equippedToType === 'player' ? true : e.equippedToId === equippedToId)
    );
    if (sameTypeEquipped) {
      await storage.updateEquipment(sameTypeEquipped.id, {
        isEquipped: false, equippedToId: null, equippedToType: null,
      });
    }
    res.json(await storage.updateEquipment(equipId, {
      isEquipped: true, equippedToId, equippedToType,
    }));
  });

  app.post(api.equipment.unequip.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const equips  = await storage.getEquipment(userId);
    if (!equips.find(e => e.id === equipId)) return res.status(404).json({ message: "Equipment not found" });
    res.json(await storage.updateEquipment(equipId, {
      isEquipped: false, equippedToId: null, equippedToType: null,
    }));
  });

  app.post(api.equipment.recycle.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const equips  = await storage.getEquipment(userId);
    const target  = equips.find(e => e.id === equipId);
    if (!target)         return res.status(404).json({ message: "Equipment not found" });
    if (target.isEquipped) return res.status(400).json({ message: "Cannot recycle equipped item" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    await storage.updateUser(userId, { upgradeStones: (user.upgradeStones || 0) + 5 });
    await storage.deleteEquipment(equipId);
    res.json({ stonesGained: 5 });
  });

  app.post("/api/equipment/recycle-rarity", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      res.json(await storage.recycleEquipment(userId));
    } catch (error) {
      console.error("Recycle error:", error);
      res.status(500).json({ message: "Failed to recycle items" });
    }
  });

  app.post(api.equipment.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId        = req.user.claims.sub;
    const equipId       = Number(req.params.id);
    const upgradeAmount = Math.max(1, Math.floor(Number(req.body.amount ?? 1)));
    const user          = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.upgradeStones || 0) < upgradeAmount) return res.status(400).json({ message: "Not enough upgrade stones" });
    const equips = await storage.getEquipment(userId);
    const eq     = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });
    if (eq.level >= 20) return res.status(400).json({ message: "Equipment already at max level" });
    await storage.updateUser(userId, { upgradeStones: user.upgradeStones - upgradeAmount });

    let newExp       = eq.experience + 50 * upgradeAmount;
    let newLevel     = eq.level;
    let newExpToNext = eq.expToNext;
    let atkBonus     = eq.attackBonus;
    let defBonus     = eq.defenseBonus;
    let spdBonus     = eq.speedBonus;

    const growth = EQUIP_RARITY_GROWTH[eq.rarity] ?? EQUIP_RARITY_GROWTH.white;

    while (newExp >= newExpToNext) {
      newExp       -= newExpToNext;
      newLevel++;
      newExpToNext  = calcEquipExpToNext(newLevel);
      atkBonus      = Math.floor(atkBonus * growth.atk) + 1;
      defBonus      = Math.floor(defBonus * growth.def) + 1;
      spdBonus      = Math.floor(spdBonus * growth.spd) + 1;
    }

    res.json(await storage.updateEquipment(eq.id, {
      experience: newExp, level: newLevel, expToNext: newExpToNext,
      attackBonus: atkBonus, defenseBonus: defBonus, speedBonus: spdBonus,
    }));
  });

  app.post("/api/equipment/:id/endow", isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { type, protect } = req.body;
    const user    = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const equips = await storage.getEquipment(userId);
    const eq     = equips.find(e => e.id === equipId);
    if (!eq) return res.status(404).json({ message: "Equipment not found" });
    if (user.endowmentStones < 1) return res.status(400).json({ message: "Not enough endowment stones" });
    const currentPoints = eq.endowmentPoints || 0;
    const baseRate      = type === 'extreme' ? 0.7 : 0.9;
    const successRate   = Math.max(0.1, baseRate - currentPoints * 0.02);
    const roll          = Math.random();
    let pointsGained    = 0;
    let failed          = false;
    if (roll < successRate) {
      if (type === 'advanced') {
        const ar = Math.random();
        if      (ar < 0.10) pointsGained = 5;
        else if (ar < 0.25) pointsGained = 4;
        else if (ar < 0.45) pointsGained = 3;
        else if (ar < 0.70) pointsGained = 2;
        else                pointsGained = 1;
      } else { pointsGained = 1; }
    } else {
      failed = true;
      const talismanField = type === 'extreme' ? 'flameEmperorTalisman' : 'fireGodTalisman';
      const hasTalisman   = (user[talismanField as keyof typeof user] as number) > 0;
      if (protect && hasTalisman) {
        pointsGained = 0;
        await storage.updateUser(userId, { [talismanField]: (user[talismanField as keyof typeof user] as number) - 1 });
      } else {
        pointsGained = -Math.floor(Math.random() * 5) - 1;
      }
    }
    const newPoints = Math.max(0, Math.min(70, currentPoints + pointsGained));
    await storage.updateUser(userId, { endowmentStones: user.endowmentStones - 1 });
    const updated = await storage.updateEquipment(eq.id, { endowmentPoints: newPoints });
    res.json({ success: !failed, pointsGained, newPoints, equipment: updated });
  });
}
