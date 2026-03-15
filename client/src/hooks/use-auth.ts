/**
 * client/src/hooks/use-auth.ts
 *
 * Supports two auth modes:
 *
 *   supabase  — reads Supabase session; subscribes to onAuthStateChange.
 *   dev       — UUID from localStorage; always treated as authenticated.
 *               No loading delay, no Supabase calls.
 *
 * Both modes return the same shape:
 *   user, isLoading, isAuthenticated, logout(), session
 */
import { useEffect, useState } from "react";
import type { User } from "@shared/models/auth";
import { supabase } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";
import { api } from "@shared/routes";
import type { Session } from "@supabase/supabase-js";
import { IS_DEV_AUTH, getOrCreateDevUserId, resetDevUser } from "../lib/devAuth";

// ── Dev-mode auth hook ────────────────────────────────────────────────────────
function useAuthDev() {
  const devUserId = getOrCreateDevUserId();

  const user: User = {
    id:              devUserId,
    email:           `${devUserId}@dev.local`,
    firstName:       "Dev",
    lastName:        "Player",
    profileImageUrl: null,
    createdAt:       null,
    updatedAt:       null,
  };

  function logout() {
    resetDevUser();           // wipe localStorage UUID
    queryClient.clear();
    window.location.href = "/";
  }

  return {
    user,
    isLoading:       false,   // never loading — UUID is always synchronous
    isAuthenticated: true,    // always authenticated in dev mode
    logout,
    isLoggingOut:    false,
    session:         null,
  };
}

// ── Supabase auth hook ────────────────────────────────────────────────────────
function useAuthSupabase() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
      if (data.session) {
        queryClient.invalidateQueries({ queryKey: [api.player.get.path] });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
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
        id:    session.user.id,
        email: session.user.email ?? null,
        firstName:
          (session.user.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ").at(0) ?? null,
        lastName:
          (session.user.user_metadata?.["full_name"] as string | undefined)
            ?.split(" ").slice(1).join(" ") || null,
        profileImageUrl:
          (session.user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
        createdAt:  session.user.created_at  ? new Date(session.user.created_at)  : null,
        updatedAt:  session.user.updated_at  ? new Date(session.user.updated_at)  : null,
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

// ── Unified export ────────────────────────────────────────────────────────────
export function useAuth() {
  return IS_DEV_AUTH ? useAuthDev() : useAuthSupabase();
}
