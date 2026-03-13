import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";
import { PET_RARITY_GROWTH } from "../constants/rarityGrowth";

export function registerPetRoutes(app: Express) {
  app.get(api.pets.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.getPets(userId));
  });

  app.post(api.pets.setActive.path, isAuthenticated, async (req: any, res) => {
    const userId  = req.user.claims.sub;
    const petId   = Number(req.params.id);
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
    if (!target)         return res.status(404).json({ message: "Pet not found" });
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

    let newExp       = pet.experience + 50 * upgradeAmount;
    let newLevel     = pet.level;
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
}
