# Auth Migration — Phase 3

## Goal
Link every Supabase auth identity to a game-user row in the `users` table
so all existing routes can keep using `req.user.claims.sub` (a plain UUID)
unchanged, and the client reads its session directly from the Supabase SDK
rather than a cookie endpoint.

Runtime behaviour is **unchanged** — `AUTH_PROVIDER=replit` remains the
default and all live traffic still goes through Replit auth.

## Status
✅ Complete

## What changed

| File | Change |
|------|--------|
| `shared/schema.ts` | Added `authUserId varchar UNIQUE` column to the `users` table — nullable, populated only on Supabase sign-in |
| `server/storage.ts` | Added `getUserByAuthId(authUserId)` to `IStorage` interface and `DatabaseStorage` — looks up a game row by Supabase UUID |
| `server/auth/index.ts` | `isAuthenticated` (Supabase path) now auto-upserts a `users` row on first sign-in, migrates existing email-matched rows, and sets `req.user.claims.sub = gameUser.id` for downstream compatibility |
| `client/src/hooks/use-auth.ts` | Dual-mode hook — Supabase path uses `supabase.auth.getSession()` + `onAuthStateChange`; Replit path is unchanged |

## Rules during Phase 3
- Keep `AUTH_PROVIDER=replit` and `VITE_AUTH_PROVIDER=replit` in your environment.
- Run `npm run db:push` (or apply migration) to add the `auth_user_id` column before
  flipping to Supabase.
- **Do not** call `storage.getUserByAuthId()` outside `server/auth/index.ts`.
- **Do not** use `supabase.auth.*` in live page code yet — only in `use-auth.ts`.

## Migration SQL (manual fallback if db:push is unavailable)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id VARCHAR UNIQUE;
```

## Exit criteria
- [x] `auth_user_id` column exists in `users` table (nullable, unique)
- [x] `storage.getUserByAuthId()` implemented
- [x] `isAuthenticated` (Supabase path) auto-creates/migrates game-user rows
- [x] `req.user.claims.sub` is set to `gameUser.id` in Supabase middleware
- [x] `useAuth()` reads `supabase.auth.getSession()` when `VITE_AUTH_PROVIDER=supabase`
- [x] Replit path completely unchanged

## Next: Phase 4 — UI Auth Flow
- Replace the static login redirect with a proper Supabase OAuth sign-in button
- Add a `<AuthGuard>` component that checks `useAuth().isAuthenticated` and
  redirects to `/login` when false
- Build a `/login` page that calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Pass the Supabase Bearer token in all `fetch()` calls when `VITE_AUTH_PROVIDER=supabase`
  (update the API client / React Query defaults)
