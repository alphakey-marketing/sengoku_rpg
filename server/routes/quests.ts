import { Router } from "express";
import { storage } from "../storage";

export const questsRouter = Router();

questsRouter.get("/", async (req: any, res) => {
  res.json(await storage.getQuests(req.user.claims.sub));
});

questsRouter.post("/:key/claim", async (req: any, res) => {
  res.json(await storage.claimQuest(req.user.claims.sub, req.params.key));
});
