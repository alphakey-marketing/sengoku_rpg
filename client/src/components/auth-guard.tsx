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
 */
import { useState } from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlayer } from "@/hooks/use-game";
import { IntroOverlay } from "@/components/intro-overlay";
import { apiRequest } from "@/lib/queryClient";

interface AuthGuardProps {
  children: React.ReactNode;
  routePath?: string;
}

export function AuthGuard({ children, routePath }: AuthGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: player, isLoading: playerLoading } = usePlayer();
  const [introDismissed, setIntroDismissed] = useState(false);

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

  if (playerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const currentChapter = player?.currentChapter ?? 0;

  // Exempt /story AND /story/:chapterId (any path starting with /story)
  const isStoryRoute = routePath?.startsWith("/story") ?? false;

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
