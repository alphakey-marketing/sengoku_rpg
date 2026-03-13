/**
 * routes.ts — thin orchestrator (Phase 5 refactor)
 *
 * All business logic now lives in server/routes/*.ts sub-modules.
 * This file only wires auth and delegates to each domain router.
 */
import type { Express } from "express";
import { type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";

import { registerPlayerRoutes }         from "./routes/player";
import { registerCompanionRoutes }      from "./routes/companions";
import { registerStatsRoutes }          from "./routes/stats";
import { registerEquipmentRoutes }      from "./routes/equipment";
import { registerPetRoutes }            from "./routes/pets";
import { registerHorseRoutes }          from "./routes/horses";
import { registerTransformationRoutes } from "./routes/transformations";
import { registerBattleRoutes }         from "./routes/battle";
import { registerGachaRoutes }          from "./routes/gacha";
import { registerQuestRoutes }          from "./routes/quests";

// VN story engine
import { storyRouter } from "./story-routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  registerPlayerRoutes(app);
  registerCompanionRoutes(app);
  registerStatsRoutes(app);
  registerEquipmentRoutes(app);
  registerPetRoutes(app);
  registerHorseRoutes(app);
  registerTransformationRoutes(app);
  registerBattleRoutes(app);
  registerGachaRoutes(app);
  registerQuestRoutes(app);

  // VN story engine — all routes live under /api/story
  app.use("/api/story", isAuthenticated, storyRouter);

  return httpServer;
}
