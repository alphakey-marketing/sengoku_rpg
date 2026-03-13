import { storage } from "../storage";
import { calcEquipExpToNext } from "./levelUp";
import { EQUIP_RARITY_GROWTH } from "../constants/rarityGrowth";

/**
 * Give exp to every equipped item owned by userId, batching all DB writes
 * in parallel (Phase 3 optimisation — preserved here after Phase 5 split).
 */
export async function giveEquipmentExp(userId: string, expAmount: number) {
  if (expAmount <= 0) return;

  const equips  = await storage.getEquipment(userId);
  const equipped = equips.filter(e => e.isEquipped);
  if (equipped.length === 0) return;

  type UpdatePayload = { id: number; changes: Record<string, any> };
  const updates: UpdatePayload[] = [];

  for (const eq of equipped) {
    let newExp       = eq.experience + expAmount;
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

    if (newLevel !== eq.level) {
      updates.push({
        id: eq.id,
        changes: {
          experience: newExp, level: newLevel, expToNext: newExpToNext,
          attackBonus: atkBonus, defenseBonus: defBonus, speedBonus: spdBonus,
        },
      });
    } else if (newExp !== eq.experience) {
      updates.push({ id: eq.id, changes: { experience: newExp } });
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates.map(u => storage.updateEquipment(u.id, u.changes)));
  }
}
