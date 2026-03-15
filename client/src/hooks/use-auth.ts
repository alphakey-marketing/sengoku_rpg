/**
 * client/src/hooks/use-auth.ts
 *
 * Phase 5: Replit auth retired. This hook always uses Supabase.
 *
 * Reads supabase.auth.getSession() on mount and subscribes to
 * onAuthStateChange for cross-tab / token-refresh sync.
 *
 * When a new session arrives (SIGNED_IN / TOKEN_REFRESHED) only the
 * /api/player query is invalidated — not the entire cache — so in-flight
 * battle / gacha / equipment queries are not disrupted.
 *
 * Returned shape:
 *   user            — mapped User | null
 *   isLoading       — true until the first getSession() resolves
 *   isAuthenticated — true when a live session exists
 *   logout()        — calls supabase.auth.signOut() then redirects to /
 *   session         — raw Supabase Session | null
 */
import { useEffect, useState } from "react";
import type { User } from "@shared/models/auth";
import { supabase } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";
import { api } from "@shared/routes";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Seed state from localStorage on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
      // If a session was already present (returning user / page refresh)
      // invalidate the player query so it re-fetches with the current token.
      if (data.session) {
        queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
      // On fresh sign-in or token refresh, clear only the player cache so the
      // AuthGuard reads fresh currentChapter / hasSeenIntro values without
      // nuking in-flight battle, gacha, or equipment caches.
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = "/";
  }

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? null,
        firstName:
          (session.user.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ")
            .at(0) ?? null,
        lastName:
          (session.user.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ")
            .slice(1)
            .join(" ") || null,
        profileImageUrl:
          (session.user.user_metadata?.["avatar_url"] as string | undefined) ??
          null,
        createdAt: session.user.created_at
          ? new Date(session.user.created_at)
          : null,
        updatedAt: session.user.updated_at
          ? new Date(session.user.updated_at)
          : null,
      }
    : null;

  return {
    user,
    isLoading,
    isAuthenticated: !!session,
    logout,
    isLoggingOut: false,
    session,
  };
}
