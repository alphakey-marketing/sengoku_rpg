import { Router, type Request, type Response } from "express";
import { storage } from "../storage";

export const locationsRouter = Router();

locationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub as string;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    const cur = user.currentLocationId || 1;
    res.json([
      { id: 1,   name: "Owari Province",   description: "Nobunaga's homeland",         maxLevel: 1, isUnlocked: true },
      { id: 2,   name: "Mino Province",    description: "The Viper's domain",           maxLevel: 2, isUnlocked: cur >= 2 },
      { id: 3,   name: "Kyoto",            description: "The Imperial capital",         maxLevel: 3, isUnlocked: cur >= 3 },
      { id: 4,   name: "Omi Province",     description: "Azai and Asakura territory",   maxLevel: 4, isUnlocked: cur >= 4 },
      { id: 5,   name: "Echizen Province", description: "Northern gateway",             maxLevel: 5, isUnlocked: cur >= 5 },
      { id: 6,   name: "Nagashino",        description: "The gunpowder battlefield",    maxLevel: 6, isUnlocked: cur >= 6 },
      { id: 101, name: "Yellow River",     description: "The rivers of ancient China", maxLevel: 7, isUnlocked: cur >= 101 },
      { id: 102, name: "Chang'an",         description: "The eternal capital",          maxLevel: 8, isUnlocked: cur >= 102 },
    ]);
  } catch (e) {
    console.error("[locations] GET /", e);
    res.status(500).json({ message: "Internal server error" });
  }
});
