/**
 * server/auth/index.ts
 *
 * Single import point for auth across the app.
 * Phase 1: delegates to Replit auth when AUTH_PROVIDER=replit (default).
 * Phase 2: Supabase JWT middleware is now wired. Still inactive until
 *          AUTH_PROVIDER is flipped to "supabase".
 * Phase 3: On first Supabase sign-in the middleware auto-upserts a users row
 *          and attaches req.user.claims.sub = gameUser.id so all downstream
 *          routes remain unchanged.
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
import { storage } from "../storage";

// ─── setup ───────────────────────────────────────────────────────────────────

export async function setupAuth(app: Express) {
  if (AUTH_PROVIDER === "replit") {
    return setupReplitAuth(app);
  }

  // Supabase: no server-side session setup needed — JWT is stateless.
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

  // Supabase: logout redirect (client calls supabase.auth.signOut() directly)
  app.get("/api/logout", (_req, res) => {
    return res.redirect("/");
  });

  // Current user endpoint — returns game-user row enriched with Supabase identity
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
      data: { user: supabaseUser },
      error,
    } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !supabaseUser) {
      return res
        .status(401)
        .json({ message: error?.message ?? "Unauthorized: invalid token" });
    }

    // ── Phase 3: Resolve (or create) the game-user row ──────────────────────
    // Look up by authUserId first, then fall back to email for accounts that
    // existed before Phase 3 (so their game data is preserved).
    let gameUser = await storage.getUserByAuthId(supabaseUser.id);

    if (!gameUser && supabaseUser.email) {
      // Try to claim an existing account created via Replit that shares the
      // same email — stamp it with the Supabase auth UUID.
      const { db } = await import("../db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, supabaseUser.email));
      if (existing) {
        gameUser = await storage.updateUser(existing.id, {
          authUserId: supabaseUser.id,
        });
      }
    }

    if (!gameUser) {
      // First sign-in: create a brand-new game-user row.
      gameUser = await storage.upsertUser({
        id: undefined as any, // let the DB generate a UUID
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

    // Attach both identities to the request:
    //   req.supabaseUser  — raw Supabase auth user (for /api/auth/user)
    //   req.user.claims.sub — game-user UUID used by all existing routes
    (req as any).supabaseUser = supabaseUser;
    (req as any).user = { claims: { sub: gameUser.id } };

    return next();
  } catch (err) {
    return res.status(500).json({ message: String(err) });
  }
};
