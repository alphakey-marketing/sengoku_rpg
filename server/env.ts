/**
 * Centralised environment variable validation.
 * Imported at the top of server/index.ts so a missing config causes
 * an early, descriptive crash rather than a confusing runtime error.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `\n\n═══════════════════════════════════════\n` +
      `❌ Missing required environment variable: ${key}\n` +
      `\n` +
      `📝 To fix this:\n` +
      `   1. Add the secret in Replit Secrets (or .env locally)\n` +
      `   2. Restart the server\n` +
      `═══════════════════════════════════════\n\n`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const env = {
  // ---- Database ----
  // Renamed from DATABASE_URL to avoid Replit reserving that key for its own
  // Neon DB, which blocks publishing when an external DB is in use.
  SUPABASE_DB_URL: requireEnv("SUPABASE_DB_URL"),

  // ---- Supabase Auth ----
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // ---- Server ----
  PORT: parseInt(optionalEnv("PORT", "5000"), 10),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PRODUCTION,
} as const;

console.log(`\n✅ Environment validated successfully`);
console.log(`   NODE_ENV: ${env.NODE_ENV}`);
console.log(`   PORT: ${env.PORT}`);
console.log(`   DATABASE: ${env.SUPABASE_DB_URL.split('@')[1] || 'configured'}`);
console.log(`   SUPABASE: ${env.SUPABASE_URL}`);
console.log(``);
