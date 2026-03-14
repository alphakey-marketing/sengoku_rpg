/**
 * server/auth/index.ts
 * ---
 * Single import point for auth across the entire server.
 * During Phase 1 this delegates to Replit auth.
 * In Phase 2 the supabase branch will be wired up here.
 *
 * RULES (Phase 1):
 *   - Keep AUTH_PROVIDER=replit in your env.
 *   - Do NOT import from server/replit_integrations/auth anywhere else.
 *   - Do NOT add new code that reads req.user.claims.sub outside this file.
 */
import type { Express, RequestHandler } from "express";
import {
  setupAuth as setupReplitAuth,
  registerAuthRoutes as registerReplitAuthRoutes,
  isAuthenticated as replitIsAuthenticated,
} from "../replit_integrations/auth";
import { AUTH_PROVIDER } from "./config";

export async function setupAuth(app: Express) {
  if (AUTH_PROVIDER === "replit") {
    return setupReplitAuth(app);
  }

  throw new Error(
    'Supabase auth runtime is not implemented yet. Keep AUTH_PROVIDER="replit" during Phase 1.',
  );
}

export function registerAuthRoutes(app: Express) {
  if (AUTH_PROVIDER === "replit") {
    return registerReplitAuthRoutes(app);
  }

  // Placeholder routes — will be replaced by Supabase flows in Phase 2
  app.get("/api/login", (_req, res) => {
    res.status(503).json({
      message:
        'Supabase auth is planned but not active yet. Keep AUTH_PROVIDER="replit" during Phase 1.',
    });
  });

  app.get("/api/callback", (_req, res) => {
    res.status(503).json({
      message:
        'Supabase auth is planned but not active yet. Keep AUTH_PROVIDER="replit" during Phase 1.',
    });
  });

  app.get("/api/logout", (_req, res) => {
    res.status(503).json({
      message:
        'Supabase auth is planned but not active yet. Keep AUTH_PROVIDER="replit" during Phase 1.',
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (AUTH_PROVIDER === "replit") {
    return replitIsAuthenticated(req, res, next);
  }

  return res.status(503).json({
    message:
      'Supabase auth middleware is not implemented yet. Keep AUTH_PROVIDER="replit" during Phase 1.',
  });
};
