import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { api } from "@shared/routes";

export function registerTransformationRoutes(app: Express) {
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
    const transforms = await storage.getTransformations(userId);
    const transform  = transforms.find(t => t.id === transformId);
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
}
