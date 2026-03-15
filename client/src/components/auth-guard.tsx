/**
 * client/src/components/auth-guard.tsx
 *
 * Route-level authentication + onboarding guard.
 *
 * Behaviour after authentication resolves:
 *   1. Not authenticated                → redirect to /login
 *   2. New player (currentChapter === 0
 *      AND not on a /story* route)     → redirect to /story
 *   3. First-time intro not yet seen   → show IntroOverlay once
 *   4. Everything OK                   → render children
 *
 * /story and /story/:chapterId are both exempted from the chapter-0
 * redirect so no route within the story flow causes an infinite loop.
 *
 * Safety net: if playerLoading just finished and currentChapter is
 * still 0 on a non-story route, we invalidate + await one extra refetch
 * before committing to the /story redirect. This handles the race where
 * navigate() fires fractionally before triggerCompletion()'s own
 * refetchQueries() updates the cache.
 */
import { useState, useEffect, useRef } from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlayer } from "@/hooks/use-game";
import { IntroOverlay } from "@/components/intro-overlay";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

interface AuthGuardProps {
  children: React.ReactNode;
  routePath?: string;
}

export function AuthGuard({ children, routePath }: AuthGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: player, isLoading: playerLoading } = usePlayer();
  const [introDismissed, setIntroDismissed] = useState(false);
  // Safety-net state: true while we are doing one extra re-fetch
  const [revalidating, setRevalidating] = useState(false);
  const revalidatedRef = useRef(false);

  const isStoryRoute = routePath?.startsWith("/story") ?? false;
  const currentChapter = player?.currentChapter ?? 0;

  // Safety net: player loaded, chapter still 0, not on story route,
  // and we haven't already done the extra fetch this mount.
  useEffect(() => {
    if (
      !authLoading &&
      isAuthenticated &&
      !playerLoading &&
      currentChapter === 0 &&
      !isStoryRoute &&
      !revalidatedRef.current
    ) {
      revalidatedRef.current = true;
      setRevalidating(true);
      queryClient
        .invalidateQueries({ queryKey: [api.player.get.path] })
        .then(() => queryClient.refetchQueries({ queryKey: [api.player.get.path] }))
        .finally(() => setRevalidating(false));
    }
  }, [authLoading, isAuthenticated, playerLoading, currentChapter, isStoryRoute]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Show spinner while initial player load or safety-net revalidation runs
  if (playerLoading || revalidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (currentChapter === 0 && !isStoryRoute) {
    return <Redirect to="/story" />;
  }

  const needsIntro = player && !player.hasSeenIntro && !introDismissed;

  async function handleIntroDismiss() {
    setIntroDismissed(true);
    try {
      await apiRequest("POST", "/api/player/mark-intro-seen");
    } catch {
      // Non-critical
    }
  }

  if (needsIntro) {
    return <IntroOverlay onDismiss={handleIntroDismiss} />;
  }

  return <>{children}</>;
}
