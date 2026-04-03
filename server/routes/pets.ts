import { Router } from "express";
import { storage } from "../storage";

export const petsRouter = Router();

petsRouter.get("/", async (req: any, res) => {
  res.json(await storage.getPets(req.user.claims.sub));
});

petsRouter.post("/:id/activate", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const petId  = Number(req.params.id);
  for (const p of await storage.getPets(userId)) await storage.updatePet(p.id, { isActive: false });
  await storage.updatePet(petId, { isActive: true });
  res.json({ success: true });
});

petsRouter.post("/:id/deactivate", async (req: any, res) => {
  await storage.updatePet(Number(req.params.id), { isActive: false });
  res.json({ success: true });
});

petsRouter.post("/:id/upgrade", async (req: any, res) => {
  const userId        = req.user.claims.sub;
  const petId         = Number(req.params.id);
  const { upgradeAmount } = req.body;
  const user = await storage.getUser(userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if ((user.petEssence || 0) < upgradeAmount) return res.status(400).json({ message: "Not enough pet essence" });
  const pet = (await storage.getPets(userId)).find(p => p.id === petId);
  if (!pet) return res.status(404).json({ message: "Pet not found" });
  await storage.updatePet(petId, {
    level:   (pet.level   || 1)  + upgradeAmount,
    attack:  (pet.attack  || 5)  + upgradeAmount * 2,
    defense: (pet.defense || 5)  + upgradeAmount,
    speed:   (pet.speed   || 15) + upgradeAmount,
  });
  await storage.updateUser(userId, { petEssence: user.petEssence - upgradeAmount });
  res.json({ success: true, newLevel: (pet.level || 1) + upgradeAmount });
});
