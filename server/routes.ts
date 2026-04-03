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
import { locationsRouter }  from "./routes/locations";

export async function registerRoutes(server: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // ── Static / misc ──────────────────────────────────────────────────────
  app.use("/api/story",     isAuthenticated, storyRouter);
  app.use("/api/locations", isAuthenticated, locationsRouter);
  app.post("/api/restart",  isAuthenticated, restartHandler);

  // ── Domain routers ─────────────────────────────────────────────────────
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

  return server;
}
