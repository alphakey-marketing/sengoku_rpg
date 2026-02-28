/**
 * Centralised environment variable validation.
 * Imported at the top of server/index.ts so a missing config causes
 * an early, descriptive crash rather than a confusing runtime error.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
        `      Copy .env.example to .env and fill in all required values.`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  SESSION_SECRET: optionalEnv(
    "SESSION_SECRET",
    "dev-secret-please-change-in-production",
  ),
  ISSUER_URL: optionalEnv("ISSUER_URL"),
  REPL_ID: optionalEnv("REPL_ID"),
  PORT: parseInt(optionalEnv("PORT", "5000"), 10),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_REPLIT: !!process.env.REPL_ID,
} as const;

if (
  env.IS_PRODUCTION &&
  env.SESSION_SECRET === "dev-secret-please-change-in-production"
) {
  throw new Error(
    "[env] SESSION_SECRET must be set to a strong secret in production!",
  );
}
