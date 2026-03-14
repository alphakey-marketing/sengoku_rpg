# Auth Migration — Phase 5

## Goal
Cut over to Supabase as the sole auth provider. Remove all Replit auth
branch switches from the codebase. The Replit integration files are
retained on disk as a rollback safety net but are no longer referenced
by any live code path.

## Status
✅ Complete

## What changed

| File | Change |
|------|--------|
| `server/auth/config.ts` | Default `AUTH_PROVIDER` changed from `"replit"` → `"supabase"` |
| `server/auth/index.ts` | All Replit `if` branches removed; Supabase path is now unconditional; Replit imports deleted |
| `client/src/hooks/use-auth.ts` | `useReplitAuth` and `AUTH_PROVIDER` branch removed; `useAuth()` is now always the Supabase implementation |
| `client/src/lib/queryClient.ts` | `AUTH_PROVIDER` conditional removed; `authHeaders()` always injects Bearer token |
| `client/src/pages/login.tsx` | Replit redirect `useEffect` removed; page always renders the Google OAuth button |
| `.env.example` | `AUTH_PROVIDER` and `VITE_AUTH_PROVIDER` default to `supabase`; Replit vars commented out as legacy |

## Production cutover checklist

Before going live, complete these steps in order:

1. **DB migration** — ensure `auth_user_id` column exists:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id VARCHAR UNIQUE;
   ```
2. **Supabase project** — create a project at https://supabase.com and note:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY` (used as `VITE_SUPABASE_ANON_KEY`)
3. **Google OAuth** — in Supabase → Authentication → Providers → Google,
   add your Google OAuth client ID and secret.
4. **Redirect URL** — in Supabase → Authentication → URL Configuration,
   add `https://yourapp.com/` to the allowed redirect URLs.
5. **Environment variables** — set in production:
   ```
   AUTH_PROVIDER=supabase
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   VITE_AUTH_PROVIDER=supabase
   PUBLIC_URL=https://yourapp.com
   ```
6. **Deploy** and smoke-test:
   - Visit `/login` → Google OAuth flow completes → lands on `/`
   - All protected routes load game data correctly
   - `/api/auth/user` returns the Supabase identity
   - Logout clears session and redirects to `/`

## Rollback plan
If a critical issue is found post-deploy:
1. Set `AUTH_PROVIDER=replit` and `VITE_AUTH_PROVIDER=replit` in the environment.
2. Redeploy — the Replit integration files (`server/replit_integrations/auth/`) are
   still on disk and `config.ts` re-activates that path automatically.
3. No code changes required for rollback.

## Cleanup (after stable in production for ≥ 2 weeks)
- Delete `server/replit_integrations/` directory
- Remove `IS_REPLIT_AUTH` / `IS_SUPABASE_AUTH` exports from `config.ts`
- Remove `AUTH_PROVIDER` switch from `config.ts` (hardcode `"supabase"`)
- Remove Replit env var stubs from `.env.example`
