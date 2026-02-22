import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up authentication FIRST
  await setupAuth(app);
  registerAuthRoutes(app);

  // Player route
  app.get(api.player.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
  });

  // Companions routes
  app.get(api.companions.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const comps = await storage.getCompanions(userId);
    res.json(comps);
  });

  app.post(api.companions.setParty.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { companionIds } = req.body;
    
    if (!Array.isArray(companionIds) || companionIds.length > 5) {
      return res.status(400).json({ message: "Invalid party configuration" });
    }

    const allComps = await storage.getCompanions(userId);
    
    // Reset all party flags
    for (const comp of allComps) {
      const shouldBeInParty = companionIds.includes(comp.id);
      if (comp.isInParty !== shouldBeInParty) {
        await storage.updateCompanion(comp.id, { isInParty: shouldBeInParty });
      }
    }

    const updatedComps = await storage.getCompanions(userId);
    res.json(updatedComps);
  });

  // Equipment routes
  app.get(api.equipment.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equips = await storage.getEquipment(userId);
    res.json(equips);
  });

  app.post(api.equipment.equip.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const equipId = Number(req.params.id);
    const { equippedToId } = req.body;

    const equips = await storage.getEquipment(userId);
    const targetEquip = equips.find(e => e.id === equipId);
    
    if (!targetEquip) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const updated = await storage.updateEquipment(equipId, { 
      isEquipped: true, 
      equippedToId 
    });

    res.json(updated);
  });

  // Battle and Gacha simulation endpoints
  app.post(api.battle.field.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Simple simulation
    const expGained = Math.floor(Math.random() * 20) + 10;
    const goldGained = Math.floor(Math.random() * 10) + 5;
    
    const newExp = user.experience + expGained;
    let newLevel = user.level;
    let attackInc = 0;
    let defInc = 0;

    if (newExp >= user.level * 100) {
      newLevel++;
      attackInc = 5;
      defInc = 5;
    }

    await storage.updateUser(userId, {
      experience: newExp,
      level: newLevel,
      gold: user.gold + goldGained,
      attack: user.attack + attackInc,
      defense: user.defense + defInc,
    });

    // Chance to drop equipment
    let dropped = [];
    if (Math.random() > 0.7) {
      const drop = await storage.createEquipment({
        userId,
        name: ["Rusty Katana", "Ashigaru Armor", "Ninja Shuriken"][Math.floor(Math.random() * 3)],
        type: ["weapon", "armor", "accessory"][Math.floor(Math.random() * 3)],
        rarity: "white",
        level: user.level,
        attackBonus: Math.floor(Math.random() * 5) + 1,
        defenseBonus: Math.floor(Math.random() * 5) + 1,
      });
      dropped.push(drop);
    }

    res.json({
      victory: true,
      experienceGained: expGained,
      goldGained,
      equipmentDropped: dropped,
      logs: ["Encountered a wild Yokai!", "You struck it down.", "Victory!"],
    });
  });

  app.post(api.battle.boss.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Boss battle simulation
    const victory = Math.random() > 0.4; // 60% chance to win
    
    if (victory) {
      const expGained = 100;
      const goldGained = 50;
      const riceGained = 10; // Rice for gacha

      await storage.updateUser(userId, {
        experience: user.experience + expGained,
        gold: user.gold + goldGained,
        rice: user.rice + riceGained,
      });

      const drop = await storage.createEquipment({
        userId,
        name: "Daimyo's Armor",
        type: "armor",
        rarity: "blue",
        level: user.level + 2,
        attackBonus: 5,
        defenseBonus: 15,
      });

      res.json({
        victory: true,
        experienceGained: expGained,
        goldGained,
        equipmentDropped: [drop],
        logs: ["You challenged the Daimyo.", "It was a fierce battle.", "You emerged victorious!"],
      });
    } else {
      res.json({
        victory: false,
        experienceGained: 0,
        goldGained: 0,
        equipmentDropped: [],
        logs: ["You challenged the Daimyo.", "The enemy was too strong...", "Defeat!"],
      });
    }
  });

  app.post(api.gacha.pull.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.rice < 10) {
      return res.status(400).json({ message: "Not enough rice (need 10)" });
    }

    await storage.updateUser(userId, { rice: user.rice - 10 });

    const isHistorical = Math.random() > 0.5;
    const name = isHistorical 
      ? ["Oda Nobunaga", "Toyotomi Hideyoshi", "Tokugawa Ieyasu", "Sanada Yukimura"][Math.floor(Math.random() * 4)]
      : ["Kunoichi", "Sohei Monk", "Ronin", "Onmyoji"][Math.floor(Math.random() * 4)];
    
    const rarity = Math.random() > 0.9 ? 5 : (Math.random() > 0.7 ? 4 : 3);

    const companion = await storage.createCompanion({
      userId,
      name,
      type: isHistorical ? 'historical' : 'original',
      rarity,
      level: 1,
      attack: rarity * 10,
      defense: rarity * 10,
      skill: "Slash",
    });

    res.json({ companion });
  });

  return httpServer;
}
