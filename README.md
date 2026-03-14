# Sengoku Chronicles

A feudal Japan-themed browser RPG. Collect companions through gacha mechanics, equip weapons and armor, manage pets and horses, and battle through a campaign map with field battles, boss fights, and special encounters.

**Stack:** React 18 + TypeScript · Express.js · PostgreSQL · Drizzle ORM · Supabase Auth · Vite · Tailwind CSS · shadcn/ui

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/) — or use [Docker Compose](#docker-quick-start)
- [Supabase](https://supabase.com) project (free tier works)
- npm

---

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/alphakey-marketing/sengoku_rpg.git
cd sengoku_rpg
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Open .env and fill in your values
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `VITE_SUPABASE_URL` | ✅ | Same as SUPABASE_URL (injected into browser) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_AUTH_PROVIDER` | ✅ | Set to `supabase` |
| `PORT` | Optional | Server port (default: 5000) |

All keys found in: **Supabase Dashboard → Settings → API**

### 3. Set Up Database

```bash
# Option A — push schema directly (good for dev)
npm run db:push

# Option B — versioned migrations (recommended for production)
npm run db:generate
npm run db:migrate
```

### 4. Enable Supabase Email Auth

1. Go to **Authentication → Providers → Email** in your Supabase dashboard
2. Toggle **Enable Email provider** ON
3. For development: toggle **Confirm email** OFF
4. Save

### 5. Start Dev Server

```bash
npm run dev
```

App runs at `http://localhost:5000`.

---

## Docker Quick Start

Spins up the app and a PostgreSQL database together.

```bash
# 1. Copy and configure env
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_* vars

# 2. Start services
docker-compose up -d

# 3. Apply DB schema
docker-compose exec app npm run db:push

# 4. Check health
curl http://localhost:5000/api/health
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build client + server for production |
| `npm start` | Run production build |
| `npm run check` | TypeScript type check |
| `npm run db:push` | Sync schema directly (dev only) |
| `npm run db:generate` | Generate versioned migration files |
| `npm run db:migrate` | Apply pending migrations |

---

## Project Structure

```
├── client/              # React frontend (Vite)
│   └── src/
│       ├── components/  # UI components
│       └── pages/       # Route pages
├── server/              # Express backend
│   ├── env.ts           # Environment variable validation (fail-fast)
│   ├── db.ts            # Database connection pool
│   ├── index.ts         # Server entry point + health check
│   ├── routes.ts        # All API route handlers
│   ├── storage.ts       # Data access layer
│   └── combat.ts        # Battle calculation logic
├── shared/              # Code shared between client and server
│   ├── schema.ts        # Drizzle table definitions + Zod types
│   └── routes.ts        # API contract definitions
└── script/
    └── build.ts         # Production build script
```

---

## Health Check

```
GET /api/health
```

Returns `200 OK` with database connection status. Used by Docker `HEALTHCHECK` and uptime monitors.

```json
{ "status": "ok", "database": "connected", "environment": "production", "timestamp": "..." }
```

---

## Game Pages

| Route | Description |
|---|---|
| `/login` | Email / password sign-in and sign-up |
| `/` | Home / Dojo — player stats and equipment |
| `/party` | War Council — manage companion party (max 5) |
| `/equipment` | Armory — equip weapons, armor, accessories, horse gear |
| `/gacha` | Shrine of Summons — pull new companions (costs rice) |
| `/map` | Campaign map — field battles, boss battles, special encounters |
| `/stable` | Stable — manage pets, horses, and transformation forms |
