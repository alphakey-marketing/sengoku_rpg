/**
 * client/src/components/auth-guard.tsx
 *
 * Route-level authentication + onboarding guard.
 *
 * Behaviour after authentication resolves:
 *   1. Not authenticated          → redirect to /login
 *   2. New player (chapter === 0
 *      AND not on /story)         → redirect to /story
 *   3. Has seen intro? No         → show fullscreen IntroOverlay once,
 *                                   then proceed to destination
 *   4. Everything OK              → render children
 *
 * The /story route is explicitly exempted from the chapter-0 redirect
 * so it never causes an infinite loop.
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
  /** Pass the current route path so we can exempt /story from the redirect. */
  routePath?: string;
}

export function AuthGuard({ children, routePath }: AuthGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: player, isLoading: playerLoading } = usePlayer();
  const [introDismissed, setIntroDismissed] = useState(false);

  // ── 1. Auth loading spinner ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ── 2. Not authenticated ─────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // ── 3. Wait for player data before checking chapter ──────────────────────
  if (playerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ── 4. New player → redirect to /story (skip if already there) ───────────
  const currentChapter = player?.currentChapter ?? 0;
  const isStoryRoute = routePath === "/story";

  if (currentChapter === 0 && !isStoryRoute) {
    return <Redirect to="/story" />;
  }

  // ── 5. First-time intro overlay (shown once, then dismissed forever) ──────
  const needsIntro = player && !player.hasSeenIntro && !introDismissed;

  async function handleIntroDismiss() {
    setIntroDismissed(true);
    // Mark intro as seen on the server so it never shows again
    try {
      await apiRequest("POST", "/api/player/mark-intro-seen");
    } catch {
      // Non-critical — worst case the overlay shows once more next login
    }
  }

  if (needsIntro) {
    return <IntroOverlay onDismiss={handleIntroDismiss} />;
  }

  // ── 6. All checks passed — render the protected page ─────────────────────
  return <>{children}</>;
}
