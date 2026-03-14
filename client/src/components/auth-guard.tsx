/**
 * client/src/components/auth-guard.tsx
 *
 * Phase 4 — route-level authentication guard.
 *
 * Wrap any <Route> that requires the user to be signed in.
 * While the auth state is loading it shows a full-screen spinner.
 * Once resolved:
 *   - authenticated → renders children
 *   - unauthenticated → redirects to /login
 *
 * Usage in App.tsx:
 *   <AuthGuard><Home /></AuthGuard>
 */
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
