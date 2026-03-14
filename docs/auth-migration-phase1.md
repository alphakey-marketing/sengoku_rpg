# Auth Migration — Phase 1

## Goal
Prepare the codebase for migration from Replit Auth to Supabase Auth
without changing the live runtime during this phase.

## Status
✅ Complete

## What changed
| File | Change |
|------|--------|
| `server/auth/config.ts` | New — `AUTH_PROVIDER` env switch, defaults to `"replit"` |
| `server/auth/index.ts` | New — provider-neutral wrapper, delegates to Replit auth |
| `server/routes.ts` | Updated — imports auth from `./auth` not `./replit_integrations/auth` |
| `package.json` | Updated — added `@supabase/supabase-js` |
| `.env.example` | New — documents both Replit and Supabase env vars |

## Rules during Phase 1
- Keep `AUTH_PROVIDER=replit` in your environment.
- **Do not** add new imports from `server/replit_integrations/auth` outside `server/auth/index.ts`.
- **Do not** add new direct references to `req.user.claims.sub` in new code.
- All auth access must go through `server/auth/index.ts`.

## Exit criteria
- [x] `server/routes.ts` imports auth only from `server/auth`
- [x] Supabase env variables documented in `.env.example`
- [x] `@supabase/supabase-js` installed
- [x] New auth work starts from the abstraction layer

## Next: Phase 2
- Create `server/lib/supabase.ts` (server admin client)
- Create `client/src/lib/supabase.ts` (browser client)
- Implement Supabase JWT middleware in `server/auth/index.ts`
- Redesign user identity: convert `userId` to Supabase UUID
- Add `authUserId uuid` to schema and create DB trigger for user row creation
