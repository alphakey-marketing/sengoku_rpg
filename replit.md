# Sengoku Chronicles

## Overview

Sengoku Chronicles is a feudal Japan-themed browser RPG game. Players collect companions through gacha mechanics, equip weapons/armor, manage pets and horses, and battle through a campaign map with field battles, boss fights, and special boss encounters. The game features a Sengoku period aesthetic with dark crimson/gold theming.

The app follows a full-stack TypeScript architecture: React frontend with shadcn/ui components served by an Express backend, PostgreSQL database with Drizzle ORM, and Replit Auth for authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; no global client state library
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Animations**: Framer Motion for gacha pulls and battle animations
- **Styling**: Tailwind CSS with CSS variables for theming; custom Sengoku dark theme (crimson red primary, gold accent, dark background). Fonts: Noto Sans JP and Shippori Mincho for Japanese aesthetic
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Pages
- `/landing` - Unauthenticated landing page with login button
- `/` - Home/Dojo showing player stats and equipped items
- `/party` - War Council for managing companion party (up to 5)
- `/equipment` - Armory for equipping weapons, armor, accessories, horse gear
- `/gacha` - Shrine of Summons for pulling new companions (costs rice)
- `/map` - Campaign map with field battles, boss battles, and special boss battles across 4 locations
- `/stable` - Manage pets, horses, and transformation forms

### Backend (server/)
- **Framework**: Express.js on Node with TypeScript (tsx runtime)
- **API Pattern**: RESTful JSON API under `/api/*` prefix. Routes defined in `shared/routes.ts` with Zod schemas
- **Authentication**: Replit Auth via OpenID Connect (OIDC). Sessions stored in PostgreSQL via `connect-pg-simple`. Auth middleware in `server/replit_integrations/auth/`
- **Game Logic**: Battle calculations, gacha pulls, equipment leveling, and stat aggregation all happen server-side in `server/routes.ts`
- **Dev Server**: Vite dev server middleware served through Express in development; static files served in production

### Database
- **Database**: PostgreSQL (required, uses `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema Location**: `shared/schema.ts` (game tables) and `shared/models/auth.ts` (auth tables)
- **Migrations**: Drizzle Kit with `npm run db:push` for schema synchronization
- **Tables**:
  - `users` - Player profile + RPG stats (level, gold, rice, hp, attack, defense, speed, location)
  - `sessions` - Express session storage for Replit Auth (mandatory, do not drop)
  - `companions` - Collectible warrior companions with stats and party membership
  - `equipment` - Weapons, armor, accessories, horse gear with rarity tiers and leveling
  - `pets` - Spirit companions with skills and active status
  - `horses` - War horses with stat bonuses
  - `transformations` - Special boss transformation forms

### Shared Code (shared/)
- `schema.ts` - Drizzle table definitions and Zod insert schemas for all game entities
- `routes.ts` - API route definitions with Zod response schemas, used by both client and server
- `models/auth.ts` - Auth-specific table definitions (sessions, base users)

### Build System
- **Dev**: `npm run dev` runs tsx with Vite HMR middleware
- **Build**: `npm run build` runs custom `script/build.ts` that builds client with Vite and server with esbuild
- **Production**: `npm start` serves the built `dist/index.cjs`
- Server dependencies in an allowlist are bundled to reduce cold start syscalls; others are external

### Key Design Decisions
1. **Shared route definitions**: Both client and server reference `shared/routes.ts` ensuring API contract consistency
2. **Replit Auth integration**: Authentication is handled entirely by Replit's OIDC provider; no custom auth logic needed. The `server/replit_integrations/auth/` directory should not be significantly modified
3. **Game state server-side**: All game calculations (battles, gacha, stats) run on the server to prevent cheating
4. **Rarity system**: Equipment uses string rarities (white/green/blue/purple/gold); companions use numeric rarity (1-5 stars)
5. **Note on schema conflict**: `shared/schema.ts` and `shared/models/auth.ts` both export a `users` table. The main schema re-exports from auth but extends the users table with game fields. Be careful with imports to use the correct one

## External Dependencies

### Required Services
- **PostgreSQL**: Database for all game data and sessions. Must have `DATABASE_URL` environment variable set
- **Replit Auth (OIDC)**: Authentication provider. Requires `ISSUER_URL`, `REPL_ID`, and `SESSION_SECRET` environment variables

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migration tooling
- `express` / `express-session` - HTTP server and session management
- `connect-pg-simple` - PostgreSQL session store
- `passport` / `openid-client` - OIDC authentication flow
- `@tanstack/react-query` - Server state management
- `framer-motion` - UI animations
- `wouter` - Client-side routing
- `zod` / `drizzle-zod` - Runtime validation
- `shadcn/ui` ecosystem (Radix UI primitives, Tailwind CSS, class-variance-authority)
- `memoizee` - Caching OIDC config

### External Assets
- Google Fonts: Noto Sans JP, Shippori Mincho, DM Sans, Fira Code, Geist Mono
- Unsplash images for thematic backgrounds (landing page)