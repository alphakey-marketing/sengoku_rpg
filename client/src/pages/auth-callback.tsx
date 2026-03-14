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
    // Supabase JS v2 automatically parses the hash fragment on page load.
    // We just need to wait for onAuthStateChange to fire with SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        setLocation("/");
      }
    });

    // Also check if there's already a session (handles page refresh)
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        subscription.unsubscribe();
        setLocation("/");
      }
    });

    // Fallback: if no session after 5 seconds, redirect to login
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setLocation("/login");
    }, 5000);

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
