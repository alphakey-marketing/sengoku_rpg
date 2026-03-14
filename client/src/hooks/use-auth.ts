/**
 * client/src/hooks/use-auth.ts
 *
 * Phase 5: Replit auth retired. This hook always uses Supabase.
 *
 * Reads supabase.auth.getSession() on mount and subscribes to
 * onAuthStateChange for cross-tab / token-refresh sync.
 *
 * When a new session arrives (SIGNED_IN / TOKEN_REFRESHED) all
 * React-Query caches are invalidated so game queries that fired
 * before the token was ready automatically re-fetch with auth.
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
      // invalidate so any queries that ran before this resolves retry.
      if (data.session) {
        queryClient.invalidateQueries();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
      // On fresh sign-in or token refresh, clear stale 401 query cache
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        queryClient.invalidateQueries();
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
