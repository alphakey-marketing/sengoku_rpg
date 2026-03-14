# Auth Migration — Phase 2

## Goal
Wire the Supabase server admin client, browser client, and JWT middleware
so the codebase is ready to flip `AUTH_PROVIDER=supabase` without any
further structural changes.

Runtime behaviour is **unchanged** — `AUTH_PROVIDER=replit` remains the
default and all live traffic still goes through Replit auth.

## Status
✅ Complete

## What changed

| File | Change |
|------|--------|
| `server/lib/supabase.ts` | New — lazy admin client (`SUPABASE_SERVICE_ROLE_KEY`), throws if called while `AUTH_PROVIDER=replit` |
| `client/src/lib/supabase.ts` | New — browser client (`VITE_SUPABASE_ANON_KEY`), safe placeholder during Phase 1/2 |
| `server/auth/index.ts` | Updated — `isAuthenticated` now validates Bearer JWT via `supabaseAdmin.auth.getUser()` when `AUTH_PROVIDER=supabase`; real `/api/login`, `/api/callback`, `/api/logout` routes wired |
| `.env.example` | Updated — added `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_PROVIDER`, `PUBLIC_URL` |

## Rules during Phase 2
- Keep `AUTH_PROVIDER=replit` and `VITE_AUTH_PROVIDER=replit` in your environment.
- **Do not** call `getSupabaseAdmin()` outside `server/auth/index.ts` or `server/lib/supabase.ts`.
- **Do not** call `supabase` (browser client) from live page code yet — only import it in new auth hook files.
- All new server routes that need auth must use `isAuthenticated` from `server/auth/index.ts`.

## Exit criteria
- [x] `server/lib/supabase.ts` exists with lazy admin client
- [x] `client/src/lib/supabase.ts` exists with browser client
- [x] `isAuthenticated` validates Supabase JWT when `AUTH_PROVIDER=supabase`
- [x] `/api/login`, `/api/callback`, `/api/logout` routes implemented for Supabase path
- [x] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` documented in `.env.example`

## Next: Phase 3 — User Identity Migration
- Add `authUserId uuid` column to `users` table in `shared/schema.ts`
- Write Drizzle migration to populate `authUserId` from existing `userId` strings
- Add Supabase DB trigger (or server hook) to auto-create `users` row on first sign-in
- Update `server/storage.ts` to look up users by `authUserId` when `AUTH_PROVIDER=supabase`
- Update `client/src/hooks/use-auth.ts` to read session from `supabase.auth.getSession()` instead of `/api/auth/user` cookie endpoint
