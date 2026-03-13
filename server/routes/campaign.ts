import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";

export function registerCampaignRoutes(app: Express) {
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
}
