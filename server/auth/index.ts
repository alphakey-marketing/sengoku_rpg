/**
 * server/auth/index.ts
 *
 * Supabase is the only auth provider.
 *
 * setupAuth        — no-op (Supabase JWT is stateless)
 * registerAuthRoutes — logout + /api/auth/user
 * isAuthenticated  — validates Bearer JWT, auto-upserts game-user row
 */
import type { Express, RequestHandler } from "express";
import { getSupabaseAdmin } from "../lib/supabase";
import { storage } from "../storage";

export async function setupAuth(_app: Express) {}

export function registerAuthRoutes(app: Express) {
  // Logout — Supabase sessions are client-managed; just redirect to home
  app.get("/api/logout", (_req, res) => {
    return res.redirect("/");
  });

  // Current user — returns raw Supabase identity attached by isAuthenticated
  app.get("/api/auth/user", isAuthenticated, (req: any, res) => {
    res.json(req.supabaseUser);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
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

    // 1. Try to find existing game-user row by Supabase auth UUID
    let gameUser = await storage.getUserByAuthId(supabaseUser.id);

    // 2. If not found, upsert — this handles both brand-new users and users
    //    whose row was previously created with a different PK.
    if (!gameUser) {
      gameUser = await storage.upsertUser({
        id: supabaseUser.id,          // VARCHAR PK = Supabase UUID
        authUserId: supabaseUser.id,
        email: supabaseUser.email ?? null,
        firstName:
          (supabaseUser.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ")
            .at(0) ?? null,
        lastName:
          (supabaseUser.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ")
            .slice(1)
            .join(" ") || null,
        profileImageUrl:
          (supabaseUser.user_metadata?.["avatar_url"] as string | undefined) ??
          null,
      });
    }

    if (!gameUser) {
      console.error("[isAuthenticated] upsertUser returned null for", supabaseUser.id);
      return res.status(500).json({ message: "Failed to resolve game user" });
    }

    (req as any).supabaseUser = supabaseUser;
    // All routes use req.user.claims.sub — set it to the game-user's PK
    (req as any).user = { claims: { sub: gameUser.id } };

    return next();
  } catch (err) {
    console.error("[isAuthenticated] error:", err);
    return res.status(500).json({ message: String(err) });
  }
};
