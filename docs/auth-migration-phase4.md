# Auth Migration — Phase 4

## Goal
Build the UI auth flow so users can actually sign in and out via Supabase,
and ensure every API call carries the Bearer token when
`AUTH_PROVIDER=supabase`.

Runtime behaviour is **unchanged** — `AUTH_PROVIDER=replit` remains the
default and all live traffic still goes through Replit auth.

## Status
✅ Complete

## What changed

| File | Change |
|------|--------|
| `client/src/pages/login.tsx` | New — dedicated `/login` page. Replit mode: immediate redirect to `/api/login`. Supabase mode: "Sign in with Google" button calling `supabase.auth.signInWithOAuth`. |
| `client/src/components/auth-guard.tsx` | New — `<AuthGuard>` wrapper. Shows spinner while auth loads; redirects to `/login` if unauthenticated; renders children if authenticated. |
| `client/src/lib/queryClient.ts` | Updated — `apiRequest` and `getQueryFn` call `supabase.auth.getSession()` and inject `Authorization: Bearer <token>` when `VITE_AUTH_PROVIDER=supabase`. Replit path unchanged. |
| `client/src/App.tsx` | Updated — added `/login` route (public). All game routes wrapped with `<AuthGuard>`. `/landing` and `/login` remain public. |

## Rules during Phase 4
- Keep `AUTH_PROVIDER=replit` and `VITE_AUTH_PROVIDER=replit` in your environment.
- **Do not** call `supabase.auth.signInWithOAuth` anywhere except `login.tsx`.
- **Do not** add Bearer token logic outside `queryClient.ts`.
- The `/landing` page "ENTER THE REALM" button should now link to `/login`
  instead of `/api/login` — that is covered in Turn 2 of Phase 4.

## Exit criteria
- [x] `/login` page exists and works in both provider modes
- [x] `<AuthGuard>` wraps all protected routes in `App.tsx`
- [x] `apiRequest` injects Bearer token when `VITE_AUTH_PROVIDER=supabase`
- [x] `getQueryFn` injects Bearer token when `VITE_AUTH_PROVIDER=supabase`
- [x] Replit cookie flow completely unchanged
- [ ] `/landing` "ENTER THE REALM" button links to `/login` (Turn 2)

## Next: Phase 4 Turn 2 — Landing page button update
- Update `client/src/pages/landing.tsx`:
  - Replace `window.location.href = '/api/login'` with `setLocation('/login')`
    (using wouter's `useLocation` hook) so the SPA router handles navigation
  - No other changes

## After Phase 4: Phase 5 — Cutover
- Set `AUTH_PROVIDER=supabase` and `VITE_AUTH_PROVIDER=supabase` in production env
- Verify all protected routes require auth
- Remove / archive `server/replit_integrations/auth` after smoke tests pass
- Remove `AUTH_PROVIDER` branch switches once Replit path is fully retired
