import { Router } from "express";
import { storage } from "../storage";

export const campaignRouter = Router();

campaignRouter.get("/events", async (req: any, res) => {
  res.json(await storage.getCampaignEvents(req.user.claims.sub));
});

campaignRouter.post("/events/trigger", async (req: any, res) => {
  const userId = req.user.claims.sub;
  const { eventKey, choice } = req.body;
  if (!eventKey) return res.status(400).json({ message: "eventKey required" });
  const events = await storage.getCampaignEvents(userId);
  let event = events.find(e => e.eventKey === eventKey);
  if (!event) event = await storage.createCampaignEvent({ userId, eventKey, isTriggered: false });
  if (event.isTriggered) return res.status(400).json({ message: "Event already triggered" });
  await storage.updateCampaignEvent(event.id, { isTriggered: true, choice, completedAt: new Date() });
  res.json({ success: true });
});
