/**
 * server/auth/index.ts
 *
 * Phase 5: Replit auth retired. Supabase is the only auth provider.
 *
 * setupAuth        — no-op (Supabase JWT is stateless, no session middleware)
 * registerAuthRoutes — OAuth login/callback/logout + /api/auth/user
 * isAuthenticated  — validates Bearer JWT, auto-upserts game-user row
 */
import type { Express, RequestHandler } from "express";
import { getSupabaseAdmin } from "../lib/supabase";
import { storage } from "../storage";

// ─── setup ───────────────────────────────────────────────────────────────────

// Supabase JWT is stateless — no server-side session middleware needed.
export async function setupAuth(_app: Express) {}

// ─── routes ──────────────────────────────────────────────────────────────────

export function registerAuthRoutes(app: Express) {
  // OAuth login — redirect to Google via Supabase
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

  // OAuth callback — exchange code for session
  app.get("/api/callback", async (req, res) => {
    const code = req.query["code"] as string | undefined;
    if (!code) {
      return res.status(400).json({ message: "Missing OAuth code" });
    }
    try {
      const { error } = await getSupabaseAdmin().auth.exchangeCodeForSession(code);
      if (error) {
        return res.status(400).json({ message: error.message });
      }
      return res.redirect("/");
    } catch (err) {
      return res.status(500).json({ message: String(err) });
    }
  });

  // Logout — Supabase sessions are client-managed; redirect to home
  app.get("/api/logout", (_req, res) => {
    return res.redirect("/");
  });

  // Current user — returns raw Supabase identity attached by isAuthenticated
  app.get("/api/auth/user", isAuthenticated, (req: any, res) => {
    res.json(req.supabaseUser);
  });
}

// ─── middleware ───────────────────────────────────────────────────────────────

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

    // Resolve (or create) the game-user row
    let gameUser = await storage.getUserByAuthId(supabaseUser.id);

    if (!gameUser && supabaseUser.email) {
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
      gameUser = await storage.upsertUser({
        id: undefined as any,
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

    (req as any).supabaseUser = supabaseUser;
    (req as any).user = { claims: { sub: gameUser.id } };

    return next();
  } catch (err) {
    return res.status(500).json({ message: String(err) });
  }
};
