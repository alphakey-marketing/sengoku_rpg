/**
 * server/auth/index.ts
 *
 * Supports two auth modes controlled by AUTH_PROVIDER env var:
 *
 *   supabase (default, production)
 *     — validates Bearer JWT via Supabase admin client
 *
 *   dev (local development only)
 *     — reads `x-dev-user-id` header, auto-upserts a game-user row,
 *       no email / Supabase required; each browser gets its own UUID
 *       stored in localStorage so state is isolated per browser.
 */
import type { Express, RequestHandler } from "express";
import { getSupabaseAdmin } from "../lib/supabase";
import { storage } from "../storage";
import { IS_DEV_AUTH } from "./config";

export async function setupAuth(_app: Express) {}

export function registerAuthRoutes(app: Express) {
  app.get("/api/logout", (_req, res) => {
    return res.redirect("/");
  });

  app.get("/api/auth/user", isAuthenticated, (req: any, res) => {
    res.json(req.supabaseUser ?? { id: (req as any).user?.claims?.sub, dev: true });
  });
}

// ── Dev-mode middleware ───────────────────────────────────────────────────────
const isAuthenticatedDev: RequestHandler = async (req, res, next) => {
  const devUserId = req.headers["x-dev-user-id"];

  if (!devUserId || typeof devUserId !== "string") {
    return res.status(401).json({ message: "Dev auth: missing x-dev-user-id header" });
  }

  // Validate: must be a UUID-shaped string to prevent injection
  if (!/^[0-9a-f-]{36}$/.test(devUserId)) {
    return res.status(401).json({ message: "Dev auth: invalid user id format" });
  }

  try {
    // Find or auto-create the game-user row for this dev UUID
    let gameUser = await storage.getUser(devUserId);
    if (!gameUser) {
      gameUser = await storage.upsertUser({
        id:             devUserId,
        authUserId:     devUserId,
        email:          `${devUserId}@dev.local`,
        firstName:      "Dev",
        lastName:       "Player",
        profileImageUrl: null,
      });
    }

    (req as any).user = { claims: { sub: gameUser.id } };
    return next();
  } catch (err) {
    console.error("[isAuthenticatedDev] error:", err);
    return res.status(500).json({ message: String(err) });
  }
};

// ── Supabase middleware ───────────────────────────────────────────────────────
const isAuthenticatedSupabase: RequestHandler = async (req, res, next) => {
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
      data: { user: supabaseUser },
      error,
    } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !supabaseUser) {
      return res
        .status(401)
        .json({ message: error?.message ?? "Unauthorized: invalid token" });
    }

    let gameUser = await storage.getUserByAuthId(supabaseUser.id);

    if (!gameUser) {
      gameUser = await storage.upsertUser({
        id:             supabaseUser.id,
        authUserId:     supabaseUser.id,
        email:          supabaseUser.email ?? null,
        firstName:
          (supabaseUser.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ").at(0) ?? null,
        lastName:
          (supabaseUser.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ").slice(1).join(" ") || null,
        profileImageUrl:
          (supabaseUser.user_metadata?.["avatar_url"] as string | undefined) ?? null,
      });
    }

    if (!gameUser) {
      console.error("[isAuthenticated] upsertUser returned null for", supabaseUser.id);
      return res.status(500).json({ message: "Failed to resolve game user" });
    }

    (req as any).supabaseUser = supabaseUser;
    (req as any).user = { claims: { sub: gameUser.id } };
    return next();
  } catch (err) {
    console.error("[isAuthenticated] error:", err);
    return res.status(500).json({ message: String(err) });
  }
};

// ── Export the right middleware based on AUTH_PROVIDER ────────────────────────
export const isAuthenticated: RequestHandler = IS_DEV_AUTH
  ? isAuthenticatedDev
  : isAuthenticatedSupabase;
