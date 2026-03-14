/**
 * server/auth/index.ts
 *
 * Single import point for auth across the app.
 * Phase 1: delegates to Replit auth when AUTH_PROVIDER=replit (default).
 * Phase 2: Supabase JWT middleware is now wired. Still inactive until
 *          AUTH_PROVIDER is flipped to "supabase".
 *
 * DO NOT import from server/replit_integrations/auth outside this file.
 */
import type { Express, RequestHandler } from "express";
import {
  setupAuth as setupReplitAuth,
  registerAuthRoutes as registerReplitAuthRoutes,
  isAuthenticated as replitIsAuthenticated,
} from "../replit_integrations/auth";
import { AUTH_PROVIDER } from "./config";
import { getSupabaseAdmin } from "../lib/supabase";

// ─── setup ───────────────────────────────────────────────────────────────────

export async function setupAuth(app: Express) {
  if (AUTH_PROVIDER === "replit") {
    return setupReplitAuth(app);
  }

  // Supabase: no server-side session setup needed — JWT is stateless.
  // Nothing to do here; middleware is applied per-route via isAuthenticated.
}

// ─── routes ──────────────────────────────────────────────────────────────────

export function registerAuthRoutes(app: Express) {
  if (AUTH_PROVIDER === "replit") {
    return registerReplitAuthRoutes(app);
  }

  // Supabase Phase 2: OAuth login redirect
  app.get("/api/login", async (_req, res) => {
    try {
      const { data, error } = await getSupabaseAdmin().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${process.env.PUBLIC_URL ?? ""}/api/callback`,
        },
      });
      if (error || !data.url) {
        return res
          .status(500)
          .json({ message: error?.message ?? "OAuth init failed" });
      }
      return res.redirect(data.url);
    } catch (err) {
      return res.status(500).json({ message: String(err) });
    }
  });

  // Supabase Phase 2: OAuth callback — exchange code for session
  app.get("/api/callback", async (req, res) => {
    const code = req.query["code"] as string | undefined;
    if (!code) {
      return res.status(400).json({ message: "Missing OAuth code" });
    }
    try {
      const { error } = await getSupabaseAdmin().auth.exchangeCodeForSession(
        code,
      );
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      return res.redirect("/");
    } catch (err) {
      return res.status(500).json({ message: String(err) });
    }
  });

  // Supabase Phase 2: logout (client handles token removal; this is a convenience redirect)
  app.get("/api/logout", (_req, res) => {
    // Supabase sessions are client-managed (JWT).
    // Client calls supabase.auth.signOut() directly.
    // This endpoint exists for parity with Replit auth redirects.
    return res.redirect("/");
  });

  // Current user from JWT
  app.get("/api/auth/user", isAuthenticated, (req: any, res) => {
    res.json(req.supabaseUser);
  });
}

// ─── middleware ───────────────────────────────────────────────────────────────

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (AUTH_PROVIDER === "replit") {
    return replitIsAuthenticated(req, res, next);
  }

  // Supabase: validate Bearer JWT from Authorization header
  const authHeader = req.headers["authorization"];
  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: missing token" });
  }

  try {
    const {
      data: { user },
      error,
    } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !user) {
      return res
        .status(401)
        .json({ message: error?.message ?? "Unauthorized: invalid token" });
    }

    // Attach user to request for downstream handlers
    (req as any).supabaseUser = user;
    return next();
  } catch (err) {
    return res.status(500).json({ message: String(err) });
  }
};
