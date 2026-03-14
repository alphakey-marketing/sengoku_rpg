/**
 * client/src/hooks/use-auth.ts
 *
 * Dual-mode auth hook:
 *   VITE_AUTH_PROVIDER=replit  → fetches /api/auth/user (cookie-based, unchanged)
 *   VITE_AUTH_PROVIDER=supabase → reads supabase.auth.getSession() + subscribes
 *                                  to onAuthStateChange for real-time updates
 *
 * The returned shape is identical in both modes so the rest of the app
 * never needs to know which provider is active.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER ?? "replit";

// ── Replit path (unchanged) ───────────────────────────────────────────────────

async function fetchUserFromApi(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logoutReplit(): Promise<void> {
  window.location.href = "/api/logout";
}

function useReplitAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUserFromApi,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutReplit,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    /** Supabase session — always null in Replit mode */
    session: null as Session | null,
  };
}

// ── Supabase path ─────────────────────────────────────────────────────────────

function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate session from storage on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Keep session in sync across tabs / token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setIsLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // Map Supabase session user to the shared User shape
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

// ── Public hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  // Rules of Hooks: both hooks are defined above; we select at call-time
  // by calling only one of them based on the env var evaluated at module load.
  // This is safe because VITE_AUTH_PROVIDER cannot change at runtime.
  if (AUTH_PROVIDER === "supabase") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSupabaseAuth();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useReplitAuth();
}
