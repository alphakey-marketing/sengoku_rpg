/**
 * client/src/pages/login.tsx
 *
 * Email / password login via Supabase.
 * Google OAuth is hidden and preserved for a future commit.
 *
 * Flow:
 *   - Sign Up: creates Supabase account + game-user row on first API call
 *   - Sign In: authenticates and stores session in localStorage
 *   - No redirect callback needed — session is set directly in the browser
 */
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

/** Map raw Supabase error messages to player-friendly copy. */
function friendlyAuthError(err: any, mode: Mode): string {
  const msg: string = err?.message ?? String(err);
  // sign-up with an existing email
  if (mode === "signup" && (msg.includes("already registered") || msg.includes("already been registered"))) {
    return "That email is already registered — please sign in instead.";
  }
  // wrong password / no account on sign-in
  if (mode === "signin" && (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials"))) {
    return "Incorrect email or password. Please try again.";
  }
  // email not confirmed
  if (msg.includes("Email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  // weak password
  if (msg.includes("Password should be") || msg.includes("at least")) {
    return "Password must be at least 6 characters.";
  }
  // fallback — return the raw message but capitalised
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  if (!isLoading && isAuthenticated) {
    return <Redirect to="/" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: "success", text: "Account created! Check your email to confirm, then sign in." });
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // useAuth onAuthStateChange will pick up the session and redirect via AuthGuard
      }
    } catch (err: any) {
      setMessage({ type: "error", text: friendlyAuthError(err, mode) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 border-2 border-accent/50 rounded-full flex items-center justify-center bg-black/50">
            <span className="font-display text-4xl text-primary">戦</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-white tracking-wider">
            SENGOKU <span className="text-primary">CHRONICLES</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={submitting}
            className="bg-black/40 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-primary"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={submitting}
            minLength={6}
            className="bg-black/40 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-primary"
          />

          <Button
            type="submit"
            disabled={submitting || isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-base font-semibold tracking-widest border border-primary/50 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all duration-300 rounded-sm"
          >
            {submitting ? (
              <><Loader2 className="animate-spin mr-2" size={18} /> Please wait…</>
            ) : mode === "signin" ? "Enter the Realm" : "Create Account"}
          </Button>
        </form>

        {/* Feedback */}
        {message && (
          <p className={`mt-4 text-center text-sm ${
            message.type === "error" ? "text-red-400" : "text-green-400"
          }`}>
            {message.text}
            {/* If the error hints to sign in, show a quick-switch link */}
            {message.type === "error" && message.text.includes("sign in instead") && (
              <>
                {" "}{
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setMessage(null); }}
                    className="underline font-semibold text-primary ml-1"
                  >
                    Switch to sign in
                  </button>
                }
              </>
            )}
          </p>
        )}

        {/* Toggle sign in / sign up */}
        <p className="mt-6 text-center text-sm text-zinc-500">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setMessage(null); }}
                className="text-primary hover:underline font-semibold"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signin"); setMessage(null); }}
                className="text-primary hover:underline font-semibold"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-8 text-center text-xs text-zinc-600">
          By signing in you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
