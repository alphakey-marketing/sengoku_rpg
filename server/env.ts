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
      `   1. Copy .env.example to .env\n` +
      `   2. Fill in all required values\n` +
      `   3. Restart the server\n` +
      `═══════════════════════════════════════\n\n`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_REPLIT = !!process.env.REPL_ID;

// Generate a random session secret for development
const DEV_SESSION_SECRET = `dev-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  SESSION_SECRET: optionalEnv(
    "SESSION_SECRET",
    IS_PRODUCTION ? "" : DEV_SESSION_SECRET,
  ),
  ISSUER_URL: optionalEnv("ISSUER_URL"),
  REPL_ID: optionalEnv("REPL_ID"),
  PORT: parseInt(optionalEnv("PORT", "5000"), 10),
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PRODUCTION,
  IS_REPLIT,
} as const;

// Validate SESSION_SECRET in production
if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error(
    `\n\n═══════════════════════════════════════\n` +
    `❌ SESSION_SECRET must be set in production!\n` +
    `\n` +
    `📝 Generate a strong secret:\n` +
    `   openssl rand -hex 32\n` +
    `\n` +
    `   Then add it to your .env file:\n` +
    `   SESSION_SECRET=your-generated-secret-here\n` +
    `═══════════════════════════════════════\n\n`,
  );
}

console.log(`\n✅ Environment validated successfully`);
console.log(`   NODE_ENV: ${env.NODE_ENV}`);
console.log(`   PORT: ${env.PORT}`);
console.log(`   DATABASE: ${env.DATABASE_URL.split('@')[1] || 'configured'}`);
if (IS_REPLIT) {
  console.log(`   REPLIT_AUTH: enabled`);
}
console.log(``);
