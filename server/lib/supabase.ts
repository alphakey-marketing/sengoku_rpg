/**
 * server/lib/supabase.ts
 *
 * Server-side Supabase admin client.
 * Uses the SERVICE_ROLE key — never expose this to the browser.
 *
 * Instantiated lazily so Phase 1 (AUTH_PROVIDER=replit) never
 * throws even when SUPABASE_* env vars are empty.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IS_SUPABASE_AUTH, requireEnv } from "../auth/config";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!IS_SUPABASE_AUTH) {
    throw new Error(
      "getSupabaseAdmin() called while AUTH_PROVIDER=replit. " +
        'Switch to AUTH_PROVIDER=supabase before using this client.',
    );
  }

  if (!_client) {
    _client = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return _client;
}
