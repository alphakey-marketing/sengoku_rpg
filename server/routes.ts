import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { runTurnBasedCombat } from "./combat";

// ── Shared modules (Phase 1 refactor) ────────────────────────────────────────
import { getPlayerTeamStats } from "./helpers/teamStats";
import { applyExpGain, calcEquipExpToNext } from "./helpers/levelUp";
import {
  EQUIP_RARITY_GROWTH,
  COMPANION_RARITY_GROWTH,
  PET_RARITY_GROWTH,
} from "./constants/rarityGrowth";
import {
  generateEquipment,
  generatePet,
  generateHorse,
  generateEnemyStats,
} from "./generators/entities";
import { HORSE_RARITY_STATS, HORSE_NAMES } from "./constants/items";
import { SPECIAL_BOSSES } from "./constants/enemies";
import { pick } from "./utils";
// ─────────────────────────────────────────────────────────────────────────────

const EQUIP_TYPES = ['weapon', 'armor', 'accessory', 'horse_gear'];

function rarityFromRandom(): string {
  const r = Math.random();
  if (r > 0.99) return "5";
  if (r > 0.90) return "4";
  if (r > 0.75) return "3";
  if (r > 0.50) return "2";
  return "1";
}

// ── Equipment exp helper (Phase 3: parallel writes) ──────────────────────────
async function giveEquipmentExp(userId: string, expAmount: number) {
  if (expAmount <= 0) return;

  const equips  = await storage.getEquipment(userId);
  const equipped = equips.filter(e => e.isEquipped);
  if (equipped.length === 0) return;

  // Phase 1: compute all new states in pure CPU (no DB calls yet)
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

    // Only queue items that actually changed
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

  // Phase 2: fire all DB writes in parallel (was N serial awaits before)
  if (updates.length > 0) {
    await Promise.all(updates.map(u => storage.updateEquipment(u.id, u.changes)));
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ── Player ──────────────────────────────────────────────────────────────────
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user   = await storage.getUser(userId);
    res.json(user);
  });

  app.get(api.player.fullStatus.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(401).json({ message: "Unauthorized" });
    res.json(teamStats);
  });

  // ── Companions ───────────────────────────────────────────────────────────────
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

  // ── Stats ────────────────────────────────────────────────────────────────────
  app.post(api.stats.upgrade.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { stat } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const currentVal = (user as any)[stat] || 1;
    if (currentVal >= 99) return res.status(400).json({ message: "Stat already at maximum" });
    const cost = Math.floor((currentVal - 1) / 10) + 2;
    if ((user.statPoints || 0) < cost) {
      return res.status(400).json({ message: `Not enough stat points. Need ${cost}.` });
    }
    const updatedUser = await storage.updateUser(userId, {
      statPoints: user.statPoints - cost,
      [stat]: currentVal + 1,
    });
    res.json(updatedUser);
  });

  app.post(api.stats.bulkUpgrade.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const { upgrades } = req.body;
    const user    = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    let currentStatPoints = user.statPoints || 0;
    const updates: any = {};
    const VALID_STATS   = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
    for (const [stat, amount] of Object.entries(upgrades)) {
      if (!VALID_STATS.includes(stat)) continue;
      let val = (user as any)[stat] || 1;
      for (let i = 0; i < (amount as number); i++) {
        if (val >= 99) break;
        const cost = Math.floor((val - 1) / 10) + 2;
        if (currentStatPoints < cost) {
          return res.status(400).json({ message: "Not enough stat points for all upgrades" });
        }
        currentStatPoints -= cost;
        val++;
      }
      updates[stat] = val;
    }
    updates.statPoints = currentStatPoints;
    res.json(await storage.updateUser(userId, updates));
  });

  // ── Companion recycle / upgrade ──────────────────────────────────────────────
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

    let newExp      = comp.experience + 50;
    let newLevel    = comp.level;
    let newExpToNext = comp.expToNext;
    let hp = comp.hp, maxHp = comp.maxHp;
    let atk = comp.attack, def = comp.defense, spd = comp.speed;

    const growth        = COMPANION_RARITY_GROWTH[comp.rarity] ?? COMPANION_RARITY_GROWTH["1"];
    const specialBonus  = (comp as any).isSpecial ? 1.25 : 1.0;

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

  // ── Equipment ────────────────────────────────────────────────────────────────
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
    const targetEquip = equips.find(e => e.id === equipId);
    if (!targetEquip)         return res.status(404).json({ message: "Equipment not found" });
    if (targetEquip.isEquipped) return res.status(400).json({ message: "Cannot recycle equipped item" });
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

    let newExp      = eq.experience + 50 * upgradeAmount;
    let newLevel    = eq.level;
    let newExpToNext = eq.expToNext;
    let atkBonus    = eq.attackBonus;
    let defBonus    = eq.defenseBonus;
    let spdBonus    = eq.speedBonus;

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

  // ── Pets ─────────────────────────────────────────────────────────────────────
  app.get(api.pets.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getPets(userId));
  });

  app.post(api.pets.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    const allPets = await storage.getPets(userId);
    for (const p of allPets) {
      if (p.isActive && p.id !== petId) await storage.updatePet(p.id, { isActive: false });
    }
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    res.json(await storage.updatePet(petId, { isActive: true }));
  });

  app.post("/api/pets/:id/recycle", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const petId  = Number(req.params.id);
    const pets   = await storage.getPets(userId);
    const target = pets.find(p => p.id === petId);
    if (!target)        return res.status(404).json({ message: "Pet not found" });
    if (target.isActive) return res.status(400).json({ message: "Cannot recycle active pet" });
    const rarityEssence: Record<string, number> = {
      white: 5, green: 10, blue: 25, purple: 50, gold: 125,
      mythic: 250, exotic: 500, transcendent: 1000, celestial: 2500, primal: 5000,
    };
    const essenceGained = rarityEssence[target.rarity] || 5;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    await storage.updateUser(userId, { petEssence: (user.petEssence || 0) + essenceGained });
    await storage.deletePet(petId);
    res.json({ essenceGained });
  });

  app.post("/api/pets/:id/upgrade", isAuthenticated, async (req: any, res) => {
    const userId        = req.user.claims.sub;
    const petId         = Number(req.params.id);
    const upgradeAmount = Math.max(1, Math.floor(Number(req.body.amount ?? 1)));
    const user          = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.petEssence || 0) < upgradeAmount) return res.status(400).json({ message: "Not enough pet essence" });
    const allPets = await storage.getPets(userId);
    const pet     = allPets.find(p => p.id === petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    await storage.updateUser(userId, { petEssence: user.petEssence - upgradeAmount });

    let newExp      = pet.experience + 50 * upgradeAmount;
    let newLevel    = pet.level;
    let newExpToNext = pet.expToNext;
    let hp = pet.hp, maxHp = pet.maxHp;
    let atk = pet.attack, def = pet.defense, spd = pet.speed;

    const growth = PET_RARITY_GROWTH[pet.rarity] ?? PET_RARITY_GROWTH.white;

    while (newExp >= newExpToNext) {
      newExp       -= newExpToNext;
      newLevel++;
      newExpToNext  = Math.floor(100 * Math.pow(1.3, newLevel - 1));
      maxHp = Math.floor(maxHp * growth.hp) + 5;
      hp    = maxHp;
      atk   = Math.floor(atk  * growth.atk) + 2;
      def   = Math.floor(def  * growth.def) + 2;
      spd   = Math.floor(spd  * growth.spd) + 3;
    }

    res.json(await storage.updatePet(pet.id, {
      experience: newExp, level: newLevel, expToNext: newExpToNext,
      hp, maxHp, attack: atk, defense: def, speed: spd,
    }));
  });

  // ── Horses ───────────────────────────────────────────────────────────────────
  app.get(api.horses.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getHorses(userId));
  });

  app.post(api.horses.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const horseId = Number(req.params.id);
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
    const userId    = req.user.claims.sub;
    const { horseIds } = req.body;
    if (!horseIds || horseIds.length !== 3) {
      return res.status(400).json({ message: "Must provide exactly 3 horses" });
    }
    const horses = await Promise.all(horseIds.map((id: number) => storage.getHorse(id)));
    if (horses.some(h => !h || h.userId !== userId)) return res.status(400).json({ message: "Invalid horses" });
    if (horses.some(h => h!.isActive)) return res.status(400).json({ message: "Cannot combine active horses" });
    const baseRarity = horses[0]!.rarity;
    if (!horses.every(h => h!.rarity === baseRarity)) return res.status(400).json({ message: "All horses must be same rarity" });
    const rarityOrder = ['white','green','blue','purple','gold','mythic','exotic','transcendent','celestial','primal'];
    const currentIndex = rarityOrder.indexOf(baseRarity);
    const upgraded     = Math.random() < 0.5;
    const newRarity    = rarityOrder[upgraded && currentIndex < rarityOrder.length - 1 ? currentIndex + 1 : currentIndex];
    for (const id of horseIds) await storage.deleteHorse(Number(id));
    const newHorse    = generateHorse(userId, 1);
    newHorse.rarity   = newRarity;
    newHorse.name     = `${newRarity.toUpperCase()} ${pick(HORSE_NAMES)}`;
    const stats       = HORSE_RARITY_STATS[newRarity] ?? HORSE_RARITY_STATS.white;
    const variance    = () => 0.9 + Math.random() * 0.2;
    newHorse.speedBonus   = Math.floor(stats.speed * variance());
    newHorse.attackBonus  = Math.floor(stats.atk   * variance());
    newHorse.defenseBonus = Math.floor(stats.def   * variance());
    const created = await storage.createHorse(newHorse as any);
    res.json({ success: true, newHorse: created, upgraded });
  });

  // ── Transformations ──────────────────────────────────────────────────────────
  app.get(api.transformations.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getTransformations(userId));
  });

  app.post("/api/transformations/:id/use-stone", isAuthenticated, async (req: any, res) => {
    const userId      = req.user.claims.sub;
    const transformId = Number(req.params.id);
    const user        = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user.transformationStones || 0) < 10) {
      return res.status(400).json({ message: "Not enough transformation stones (need 10)" });
    }
    const transforms  = await storage.getTransformations(userId);
    const transform   = transforms.find(t => t.id === transformId);
    if (!transform) return res.status(404).json({ message: "Transformation not found" });
    const activeUntil = new Date();
    activeUntil.setHours(activeUntil.getHours() + 1);
    await storage.updateUser(userId, {
      transformationStones: user.transformationStones - 10,
      activeTransformId:    transformId,
      transformActiveUntil: activeUntil,
    });
    res.json({ message: "Transformation activated", activeUntil });
  });

  // ── Battles ──────────────────────────────────────────────────────────────────
  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId     = req.user.claims.sub;
    const user       = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId  = Number(req.body.locationId)  || 1;
    const count       = Math.min(Math.max(1, Number(req.body.repeatCount) || 1), 10);
    const teamStats   = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });

    let totalExpGained   = 0;
    let totalGoldGained  = 0;
    const allEquipmentDropped: any[] = [];
    const allPetsDropped:      any[] = [];
    const allHorsesDropped:    any[] = [];
    const allLogs:             string[] = [];
    let ninjaEncounter: any = null;

    for (let i = 0; i < count; i++) {
      if (count > 1) allLogs.push(`--- BATTLE ${i + 1} ---`);

      // Ninja encounter
      if (!ninjaEncounter && Math.random() < (locationId >= 100 ? 0.05 : 0.03)) {
        const ninjaNames = locationId >= 100
          ? ["Zhuge Liang (Ghost)", "Lu Bu's Spirit", "Empress Wu Zetian"]
          : ["Hattori Hanzo", "Fuma Kotaro", "Ishikawa Goemon", "Mochizuki Chiyome"];
        const ninjaName     = pick(ninjaNames);
        const isSuperStrong = Math.random() < (locationId >= 100 ? 0.5 : 0.3);
        const targetLevel   = locationId >= 100 ? 7 + (locationId - 100) : locationId;
        ninjaEncounter = {
          name:          ninjaName,
          level:         isSuperStrong ? targetLevel + 20 : targetLevel + 2,
          hp:            isSuperStrong ? 5000 : 1000,
          maxHp:         isSuperStrong ? 5000 : 1000,
          attack:        isSuperStrong ? 500  : 100,
          defense:       isSuperStrong ? 300  : 50,
          speed:         isSuperStrong ? 200  : 40,
          skills:        ["Shadow Strike", "Smoke Bomb", "Assassinate"],
          isNinja:       true,
          goldDemanded:  Math.floor(user.gold * 0.1),
        };
        allLogs.push(`A famous ninja, ${ninjaName}, blocks your path!`);
        break;
      }

      const enemy = generateEnemyStats('field', user.level, locationId);
      if (i === 0 && req.body.enemyName) enemy.name = req.body.enemyName;
      const battleResult = runTurnBasedCombat(teamStats, [enemy]);
      allLogs.push(...battleResult.logs);

      if (battleResult.victory) {
        await storage.updateQuestProgress(userId, 'daily_skirmish', 1);
        await storage.updateQuestProgress(userId, 'daily_skirmish_elite', 1);

        const expGained  = Math.floor(Math.random() * 50) + 30 + enemy.level * 5;
        const goldGained = Math.floor(Math.random() * 20) + 10 + enemy.level * 2;
        totalExpGained  += expGained;
        totalGoldGained += goldGained;

        if (Math.random() < 0.01) {
          try {
            const eq = await storage.createEquipment(generateEquipment(userId, locationId) as any);
            allEquipmentDropped.push(eq);
            allLogs.push(`Found ${eq.rarity.toUpperCase()} ${eq.name}!`);
          } catch (err) { console.error("Equipment drop failed:", err); }
        }
      }
    }

    // Apply accumulated exp/gold ONCE after the loop
    if (totalExpGained > 0) {
      const freshUser = await storage.getUser(userId);
      if (freshUser) {
        const leveled = applyExpGain(freshUser, totalExpGained);
        const endowmentStoneGained = Math.random() < 0.2 ? 1 : 0;
        const talismanGained       = Math.random() < 0.05 ? 1 : 0;
        await storage.updateUser(userId, {
          ...leveled,
          gold:             freshUser.gold + totalGoldGained,
          hp:               leveled.maxHp,
          endowmentStones:  (freshUser.endowmentStones || 0) + endowmentStoneGained,
          fireGodTalisman:  (freshUser.fireGodTalisman  || 0) + talismanGained,
        });
      }
    }

    // giveEquipmentExp now fires all updates in parallel (Phase 3)
    await giveEquipmentExp(userId, totalExpGained);

    res.json({
      victory:           totalExpGained > 0,
      experienceGained:  totalExpGained,
      goldGained:        totalGoldGained,
      equipmentDropped:  allEquipmentDropped,
      petDropped:        allPetsDropped[0]    || null,
      allPetsDropped,
      horseDropped:      allHorsesDropped[0]  || null,
      allHorsesDropped,
      logs:              allLogs,
      ninjaEncounter,
    });
  });

  app.post("/api/battle/ninja/resolve", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { action, ninjaName, goldDemanded, locationId = 1 } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (action === 'pay') {
      const goldToPay = Math.floor(Number(goldDemanded));
      if ((Number(user.gold) || 0) < goldToPay) {
        return res.status(400).json({ message: `Not enough gold. You have ${user.gold}, but ${goldToPay} is required.` });
      }
      await storage.updateUser(userId, { gold: user.gold - goldToPay });
      return res.json({ success: true, message: `You paid ${goldToPay} gold to ${ninjaName}. He vanished into the shadows.` });
    }

    // Fight the ninja
    const teamStats = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const targetLevel   = locationId >= 100 ? 7 + (locationId - 100) : locationId;
    const isSuperStrong = Math.random() < 0.3;
    const enemy = {
      name: ninjaName,
      level: isSuperStrong ? targetLevel + 20 : targetLevel + 2,
      hp: isSuperStrong ? 5000 : 1000, maxHp: isSuperStrong ? 5000 : 1000,
      attack: isSuperStrong ? 500 : 100, defense: isSuperStrong ? 300 : 50,
      speed: isSuperStrong ? 200 : 40,
      skills: ["Shadow Strike", "Smoke Bomb", "Assassinate"],
    };
    const battleResult = runTurnBasedCombat(teamStats, [enemy]);
    if (battleResult.victory) {
      const goldGained  = goldDemanded * 2;
      const stonesGained = 3 + Math.floor(Math.random() * 3);
      await storage.updateUser(userId, {
        gold:            user.gold + goldGained,
        endowmentStones: (user.endowmentStones || 0) + stonesGained,
      });
      battleResult.logs.push(`You defeated ${ninjaName} and looted ${goldGained} gold and ${stonesGained} Endowment Stones!`);
    }
    res.json({ success: true, battleResult });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId     = req.user.claims.sub;
    const user       = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId  = Number(req.body.locationId) || 1;
    const teamStats   = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const enemyData   = generateEnemyStats('boss', user.level, locationId);
    if (req.body.enemyName) enemyData.name = req.body.enemyName;
    const { victory, logs } = runTurnBasedCombat(teamStats, [enemyData]);

    if (victory) {
      await storage.updateQuestProgress(userId, 'daily_boss', 1);
      const expGained       = 100 + locationId * 50;
      const goldGained      = 50  + locationId * 25;
      const riceGained      = 10  + locationId * 5;
      const endowmentStones = 2   + Math.floor(Math.random() * 3);

      const leveled = applyExpGain(user, expGained);
      await storage.updateUser(userId, {
        ...leveled,
        gold:             user.gold + goldGained,
        rice:             user.rice + riceGained,
        hp:               leveled.maxHp,
        endowmentStones:  (user.endowmentStones || 0) + endowmentStones,
      });

      if (Math.random() < 0.05) {
        const eq = await storage.createEquipment(generateEquipment(userId, locationId, true) as any);
        return res.json({ victory: true, experienceGained: expGained, goldGained, riceGained, equipmentDropped: [eq], petDropped: null, logs });
      }
      return res.json({ victory: true, experienceGained: expGained, goldGained, riceGained, equipmentDropped: [], petDropped: null, logs });
    }
    logs.push("Defeat!");
    res.json({ victory: false, logs });
  });

  app.post(api.battle.specialBoss.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const locationId = Number(req.body.locationId) || 1;
    const teamStats  = await getPlayerTeamStats(userId);
    if (!teamStats) return res.status(400).json({ message: "Team not found" });
    const enemyData  = generateEnemyStats('special', user.level, locationId);
    if (req.body.enemyName) enemyData.name = req.body.enemyName;
    const { victory, logs } = runTurnBasedCombat(teamStats, [enemyData]);

    if (victory) {
      const expGained       = 250 + locationId * 100;
      const goldGained      = 150 + locationId * 75;
      const endowmentStones = 5   + Math.floor(Math.random() * 6);

      const leveled = applyExpGain(user, expGained);
      await storage.updateUser(userId, {
        ...leveled,
        gold:                 user.gold + goldGained,
        hp:                   leveled.maxHp,
        endowmentStones:      (user.endowmentStones      || 0) + endowmentStones,
        transformationStones: (user.transformationStones || 0) + 10,
      });

      const sb    = pick(SPECIAL_BOSSES);
      const trans = await storage.createTransformation({
        userId,
        name:             sb.transformName,
        level:            1,
        experience:       0,
        expToNext:        200,
        attackPercent:    sb.atkPct,
        defensePercent:   sb.defPct,
        speedPercent:     sb.spdPct,
        hpPercent:        sb.hpPct,
        skill:            sb.skill,
        cooldownSeconds:  60,
        durationSeconds:  30,
      });
      return res.json({ victory: true, transformationDropped: trans, logs, experienceGained: expGained, goldGained });
    }
    logs.push("Defeat!");
    res.json({ victory: false, logs });
  });

  // ── Campaign Events ──────────────────────────────────────────────────────────
  app.get(api.campaign.events.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getCampaignEvents(userId));
  });

  app.post(api.campaign.triggerEvent.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { eventKey, choice } = req.body;
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const logs: string[] = [];
    let reward: any = null;
    if (eventKey === 'onin_war') {
      if (choice === 'nobunaga') {
        logs.push("You supported the Oda clan in Owari.");
        await storage.updateUser(userId, { gold: user.gold + 500 });
        reward = { type: 'gold', amount: 500 };
      } else { logs.push("You chose to walk your own path."); }
    } else if (eventKey === 'honnoji') {
      if (choice === 'rescue') {
        logs.push("You fought through the fire to save the Lord.");
        await storage.updateUser(userId, { attack: user.attack + 10 });
        reward = { type: 'stat', stat: 'attack', amount: 10 };
      } else { logs.push("You joined the rebellion. The course of history changes."); }
    } else if (eventKey === 'yokai_random') {
      if (choice === 'ally') {
        logs.push("You formed an alliance with the fox spirit.");
        reward = await storage.createPet({
          userId, name: "Heavenly Fox", type: "yokai", rarity: "gold",
          level: 1, experience: 0, expToNext: 100,
          hp: 50, maxHp: 50, attack: 15, defense: 10, speed: 25,
          skill: "Foxfire Ward", isActive: false,
        });
      } else { logs.push("The spirit vanishes into the mist."); }
    }
    const event = await storage.createCampaignEvent({
      userId, eventKey, choice, isTriggered: true, completedAt: new Date(),
    });
    res.json({ event, logs, reward });
  });

  // ── Gacha ────────────────────────────────────────────────────────────────────
  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId    = req.user.claims.sub;
    const isSpecial = req.body?.isSpecial || false;
    const count     = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user      = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const singleCost = isSpecial ? 50 : 10;
    const totalCost  = singleCost * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    const warriorPool = [
      { name: "Oda Nobunaga",       skill: "Demon King's Command",  type: "General"   },
      { name: "Toyotomi Hideyoshi", skill: "Ape's Cunning",         type: "Strategist" },
      { name: "Tokugawa Ieyasu",    skill: "Patient Turtle",        type: "Defender"   },
      { name: "Hattori Hanzo",      skill: "Shadow Strike",         type: "Ninja"      },
      { name: "Sanada Yukimura",    skill: "Crimson Charge",        type: "Lancer"     },
      { name: "Date Masamune",      skill: "One-Eyed Dragon",       type: "Ronin"      },
      { name: "Uesugi Kenshin",     skill: "God of War",            type: "Monk"       },
      { name: "Takeda Shingen",     skill: "Furin-kazan",           type: "General"    },
      { name: "Miyamoto Musashi",   skill: "Niten Ichi-ryu",        type: "Samurai"    },
      { name: "Sasaki Kojiro",      skill: "Swallow Cut",           type: "Samurai"    },
      { name: "Honda Tadakatsu",    skill: "Unscathed General",     type: "Defender"   },
      { name: "Akechi Mitsuhide",   skill: "Tenka Fubu",            type: "Tactician"  },
    ];

    const rarityFromSpecial = () => {
      const r = Math.random();
      if (r > 0.85) return "5";
      if (r > 0.60) return "4";
      if (r > 0.30) return "3";
      return "2";
    };

    const results = [];
    for (let i = 0; i < count; i++) {
      const warrior = pick(warriorPool);
      const rarity  = isSpecial ? rarityFromSpecial() : rarityFromRandom();
      const baseStats = ({
        "1": { hp: 60,  atk: 12, def: 10, spd: 10 },
        "2": { hp: 80,  atk: 15, def: 12, spd: 12 },
        "3": { hp: 100, atk: 20, def: 15, spd: 15 },
        "4": { hp: 130, atk: 28, def: 22, spd: 20 },
        "5": { hp: 180, atk: 40, def: 35, spd: 30 },
      } as any)[rarity] ?? { hp: 60, atk: 12, def: 10, spd: 10 };
      const growthBonus = isSpecial ? 1.25 : 1.0;
      results.push(await storage.createCompanion({
        userId, name: warrior.name, type: warrior.type, rarity,
        level: 1, experience: 0, expToNext: 100,
        hp:      Math.floor(baseStats.hp  * growthBonus),
        maxHp:   Math.floor(baseStats.hp  * growthBonus),
        attack:  Math.floor(baseStats.atk * growthBonus),
        defense: Math.floor(baseStats.def * growthBonus),
        speed:   Math.floor(baseStats.spd * growthBonus),
        skill: warrior.skill, isInParty: false, isSpecial: !!isSpecial,
      }));
    }
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ companions: results });
  });

  app.post(api.gacha.pullEquipment.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count  = Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
    const user   = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const totalCost = 15 * count;
    if (user.rice < totalCost) return res.status(400).json({ message: "Not enough rice" });
    await storage.updateUser(userId, { rice: user.rice - totalCost });

    const weaponNames    = ["Masamune Katana","Muramasa Blade","Dragon Naginata","Shadow Tanto","Imperial Yari","Honjo Masamune","Kusanagi-no-Tsurugi","Onimaru","Mikazuki Munechika","Tombstone Cutter","Nihongo Spear","Otegine","Heshikiri Hasebe","Azai Ichimonji","Dragon Slaying Odachi"];
    const armorNames     = ["Oda Clan Do","Red Thread Kabuto","Shinobi Shozoku","Iron Suneate","Golden Menpo","Nanban-do Armor","Yukimura's Crimson Kabuto","Date's Crescent Helm","Dragon Scale Do","Golden Lacquer Hara-ate","Iron Menpo of Terror","Shogun's Great Armor","Shadow Stalker Garb"];
    const accessoryNames = ["Magatama of Luck","War Fan of Strategy","Ninja Kunai Set","Omamori of Health","Smoke Bomb Belt","Scroll of Hidden Mist","Sacred Mirror","Talisman of Elements","Vengeful Spirit Mask","Heirloom Inro","Dragon Bone Rosary","Jade Amulet","Phoenix Feather"];
    const horseGearNames = ["War Saddle","Iron Stirrups","Silk Reins","Steel Barding","Speed Spurs","Imperial Gold Saddle","Jade-Inlaid Stirrups","Wind-Step Horseshoes","Ceremonial Crest","Takeda War Banner","Thunder-Hoof Spurs","Celestial Bridle","Ebony Stirrups"];

    const results = [];
    for (let i = 0; i < count; i++) {
      const rDrop = Math.random();
      const type  = rDrop < 0.1 ? 'accessory' : pick(['weapon','armor','horse_gear']);
      const r     = Math.random();
      let rarity  = 'gold';
      if      (r > 0.94) rarity = 'celestial';
      else if (r > 0.88) rarity = 'transcendent';
      else if (r > 0.78) rarity = 'exotic';
      else if (r > 0.60) rarity = 'mythic';
      const name = pick(
        type === 'weapon' ? weaponNames : type === 'armor' ? armorNames :
        type === 'accessory' ? accessoryNames : horseGearNames
      );
      const statsByRarity: Record<string, { atk: number; def: number; spd: number }> = {
        gold: { atk: 35, def: 25, spd: 15 }, mythic: { atk: 60, def: 45, spd: 25 },
        exotic: { atk: 100, def: 75, spd: 45 }, transcendent: { atk: 200, def: 150, spd: 80 },
        celestial: { atk: 450, def: 350, spd: 150 },
      };
      const base = statsByRarity[rarity] ?? statsByRarity.gold;
      let weaponType: string | null = null;
      if (type === 'weapon') {
        const lower = name.toLowerCase();
        if (lower.includes('bow')) weaponType = 'bow';
        else if (lower.includes('rod') || lower.includes('staff') || lower.includes('wand')) weaponType = 'staff';
        else if (lower.includes('knife') || lower.includes('cutter') || lower.includes('gauche')) weaponType = 'dagger';
        else weaponType = 'sword';
      }
      results.push(await storage.createEquipment({
        userId, name, type, weaponType, rarity,
        level: 1, experience: 0, expToNext: 100,
        attackBonus:  type === 'weapon'    || type === 'accessory' ? base.atk : 0,
        defenseBonus: type === 'armor'     || type === 'accessory' ? base.def : 0,
        speedBonus:   type === 'horse_gear'|| type === 'accessory' ? base.spd : 0,
      }));
    }
    await storage.updateQuestProgress(userId, 'daily_gacha', count);
    await storage.updateQuestProgress(userId, 'daily_gacha_elite', count);
    res.json({ equipment: results });
  });

  // ── Misc player endpoints ────────────────────────────────────────────────────
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

  // ── Quests ───────────────────────────────────────────────────────────────────
  app.get('/api/quests', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const quests = await storage.getQuests(userId);
    const QUEST_DEFS: Record<string, { name: string; desc: string; goal: number; reward: string }> = {
      'daily_skirmish':       { name: 'Daily Skirmisher',  desc: 'Win 5 skirmishes',      goal: 5,  reward: '50 Rice'  },
      'daily_boss':           { name: 'Giant Slayer',      desc: 'Defeat a boss',          goal: 1,  reward: '30 Rice'  },
      'daily_gacha':          { name: 'Summoner',          desc: 'Perform 3 summons',      goal: 3,  reward: '40 Rice'  },
      'daily_skirmish_elite': { name: 'Elite Skirmisher',  desc: 'Win 10 skirmishes',      goal: 10, reward: '100 Rice' },
      'daily_gacha_elite':    { name: 'Elite Summoner',    desc: 'Perform 5 summons',      goal: 5,  reward: '80 Rice'  },
    };
    res.json(quests.map(q => {
      const def = QUEST_DEFS[q.questKey] ?? { name: 'Unknown Quest', desc: 'Unknown', goal: 1, reward: 'Unknown' };
      return { ...def, key: q.questKey, progress: q.progress, isClaimed: q.isClaimed };
    }));
  });

  app.post('/api/quests/:key/claim', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.claimQuest(userId, req.params.key));
  });

  return httpServer;
}
