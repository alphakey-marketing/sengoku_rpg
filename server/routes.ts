import type { Express } from "express";
import { type Server }  from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { storyRouter }      from "./story-routes";
import { playerRouter, restartHandler } from "./routes/player";
import { companionsRouter } from "./routes/companions";
import { equipmentRouter, cardsRouter } from "./routes/equipment";
import { petsRouter }       from "./routes/pets";
import { horsesRouter }     from "./routes/horses";
import { battleRouter }     from "./routes/battle";
import { gachaRouter }      from "./routes/gacha";
import { questsRouter }     from "./routes/quests";
import { campaignRouter }   from "./routes/campaign";
import { mapRouter }        from "./routes/map";
import { chronicleRouter }  from "./routes/chronicle";
import { titlesRouter }     from "./routes/titles";

export async function registerRoutes(server: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ── Static / misc ─────────────────────────────────────────────────────
  app.use("/api/story",    isAuthenticated, storyRouter);
  app.post("/api/restart", isAuthenticated, restartHandler);

  // ── Domain routers ────────────────────────────────────────────────────
  app.use("/api/player",      isAuthenticated, playerRouter);
  app.use("/api/companions",  isAuthenticated, companionsRouter);
  app.use("/api/equipment",   isAuthenticated, equipmentRouter);
  app.use("/api/cards",       isAuthenticated, cardsRouter);
  app.use("/api/pets",        isAuthenticated, petsRouter);
  app.use("/api/horses",      isAuthenticated, horsesRouter);
  app.use("/api/battle",      isAuthenticated, battleRouter);
  app.use("/api/gacha",       isAuthenticated, gachaRouter);
  app.use("/api/quests",      isAuthenticated, questsRouter);
  app.use("/api/campaign",    isAuthenticated, campaignRouter);
  app.use("/api/map",         isAuthenticated, mapRouter);
  app.use("/api/chronicle",   isAuthenticated, chronicleRouter);
  app.use("/api/titles",      isAuthenticated, titlesRouter);

  // ── Locations (static lookup) ─────────────────────────────────────────
  app.get("/api/locations", isAuthenticated, async (req: any, res) => {
    const { storage } = await import("./storage");
    const user = await storage.getUser(req.user.claims.sub);
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
  });

  return server;
}
