export type AuthProvider = "replit" | "supabase" | "dev";

const rawProvider = process.env.AUTH_PROVIDER ?? "supabase";

if (rawProvider !== "replit" && rawProvider !== "supabase" && rawProvider !== "dev") {
  throw new Error(
    `Invalid AUTH_PROVIDER "${rawProvider}". Expected "replit", "supabase", or "dev".`,
  );
}

export const AUTH_PROVIDER: AuthProvider = rawProvider as AuthProvider;
export const IS_SUPABASE_AUTH = AUTH_PROVIDER === "supabase";
export const IS_REPLIT_AUTH   = AUTH_PROVIDER === "replit";
/**
 * When true, Supabase is skipped entirely.
 * The client sends `x-dev-user-id` header; the server auto-creates
 * a game-user row for that UUID and treats it as authenticated.
 * Every new browser gets a fresh UUID (new game state) until its
 * localStorage is cleared.
 */
export const IS_DEV_AUTH      = AUTH_PROVIDER === "dev";

/**
 * Throws if a required env var is missing.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
