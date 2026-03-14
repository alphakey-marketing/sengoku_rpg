# Auth Migration — Phase 1: Abstraction Layer

## Goal

Prepare the codebase for migration from **Replit OIDC Auth** to **Supabase Auth**
without changing the live runtime behaviour yet.

The app continues to authenticate via Replit OIDC during Phase 1.
No player-facing behaviour changes.

---

## What changed in this phase

| File | Change |
|------|--------|
| `server/auth/config.ts` | `AUTH_PROVIDER` env switch with validation |
| `server/auth/index.ts` | Neutral wrapper — delegates to Replit auth when `AUTH_PROVIDER=replit` |
| `server/routes.ts` | Import changed from `./replit_integrations/auth` → `./auth` |
| `package.json` | Added `@supabase/supabase-js` dependency |
| `.env.example` | Documents both Replit and Supabase env vars |

---

## Rules during Phase 1

- Keep `AUTH_PROVIDER=replit` in your local `.env`.
- **Do NOT** add new imports from `server/replit_integrations/auth` anywhere outside `server/auth/index.ts`.
- **Do NOT** add new code that reads `req.user.claims.sub` in new routes or helpers. All new auth-dependent code should read from a helper that will be provided in Phase 2.
- All auth for new routes must go through `server/auth/index.ts`.

---

## What Phase 2 will do

- Add `server/lib/supabase.ts` (server-side admin client)
- Add `client/src/lib/supabase.ts` (browser client)
- Replace Passport / session middleware with Supabase JWT verification
- Replace `req.user.claims.sub` with a verified Supabase UUID helper
- Add `public.users` auto-creation via DB trigger on `auth.users`

---

## Exit criteria for Phase 1 ✅

- [x] `server/routes.ts` imports auth only from `server/auth`
- [x] `@supabase/supabase-js` is in `package.json`
- [x] `AUTH_PROVIDER` env var is documented in `.env.example`
- [x] Supabase env vars are defined in `.env.example`
- [x] No new direct imports from `server/replit_integrations/auth` exist outside the wrapper
