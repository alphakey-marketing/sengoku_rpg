/**
 * client/src/pages/auth-callback.tsx
 *
 * Handles the redirect back from Supabase after Google OAuth.
 * Supabase returns to this page with a #access_token hash fragment.
 * The Supabase client automatically detects and exchanges it for a session.
 * Once a session is confirmed we redirect to the home page.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let redirected = false;

    function goHome() {
      if (!redirected) {
        redirected = true;
        // Small delay so Supabase has time to persist the session to localStorage
        setTimeout(() => setLocation("/"), 300);
      }
    }

    // Listen for SIGNED_IN event from hash fragment processing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        subscription.unsubscribe();
        goHome();
      }
      if (event === "SIGNED_IN" && !session) {
        setError("Sign in failed. Please try again.");
      }
    });

    // Also check immediately — handles cases where session is already set
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (data.session) {
        subscription.unsubscribe();
        goHome();
      }
    });

    // Fallback timeout — if nothing fires in 6s, go back to login
    const timeout = setTimeout(() => {
      if (!redirected) {
        subscription.unsubscribe();
        setLocation("/login");
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [setLocation]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive text-sm">Authentication error: {error}</p>
        <button
          className="text-primary underline text-sm"
          onClick={() => setLocation("/login")}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="animate-spin text-primary" size={40} />
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
}
