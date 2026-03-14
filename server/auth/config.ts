export type AuthProvider = "replit" | "supabase";

const rawProvider = process.env.AUTH_PROVIDER ?? "supabase";

if (rawProvider !== "replit" && rawProvider !== "supabase") {
  throw new Error(
    `Invalid AUTH_PROVIDER "${rawProvider}". Expected "replit" or "supabase".`,
  );
}

export const AUTH_PROVIDER: AuthProvider = rawProvider;
export const IS_SUPABASE_AUTH = AUTH_PROVIDER === "supabase";
export const IS_REPLIT_AUTH = AUTH_PROVIDER === "replit";

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
