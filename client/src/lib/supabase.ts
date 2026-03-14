/**
 * client/src/lib/supabase.ts
 *
 * Browser-side Supabase client.
 * Uses the ANON key — safe to expose to the browser.
 *
 * Import `supabase` from this file wherever you need auth
 * (sign-in, sign-out, session listeners) on the client.
 *
 * The client is only active when AUTH_PROVIDER=supabase.
 * During Phase 1/2 it is imported but never called by live code.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (import.meta.env.VITE_AUTH_PROVIDER === "supabase") {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
        "Add them to your .env file.",
    );
  }
}

// Falls back to placeholder strings so the createClient call never
// throws during Phase 1 (the client will simply never be used).
export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
);
