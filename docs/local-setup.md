# Local setup

This guide covers the local Supabase stack used for development and testing.
It assumes the Supabase CLI is installed (`npm i -g supabase` or `npx supabase`).

## Prerequisites

- Node.js >= 20.19.0
- Supabase CLI (`npm i -g supabase`)
- Docker Desktop (required by the local stack: Postgres, Auth, Storage,
  Realtime, Studio, Edge Functions, and analytics)

## 1. Install and configure

```bash
npm install
cp .env.example .env
```

`.env.example` contains only browser-safe variables. The Supabase CLI reads
secrets from its own encrypted file (`supabase/.env.local`), never from
`.env`.

## 2. Start the local stack

```bash
npm run supabase:start
```

Services come up on these ports:

| Service        | Port  | URL                      |
| -------------- | ----- | ------------------------ |
| API            | 54321 | `http://127.0.0.1:54321` |
| Postgres       | 54322 | direct connection        |
| Studio         | 54323 | `http://127.0.0.1:54323` |
| Email inbox    | 54324 | `http://127.0.0.1:54324` |
| Edge Functions | 54321 | served through the API   |
| Analytics      | 54327 | `http://127.0.0.1:54327` |

## 3. Apply migrations and seed

Migrations live in `supabase/migrations/`. The local config applies them with
`supabase db push`:

```bash
supabase db push --dry-run   # preview pending migrations
supabase db push             # apply
```

Seeding is enabled in `supabase/config.toml` (`[db.seed]`,
`sql_paths = ["./seed.sql"]`). Seeds run automatically on `supabase db reset`:

```bash
npm run supabase:reset       # destructive: drops, re-applies migrations, re-seeds
```

**Never run `supabase db reset` against a linked production project.** It is a
destructive local-only operation.

## 4. Generate TypeScript types

```bash
npm run supabase:types
```

Writes `src/types/database.generated.ts`. Commit this file; the app imports it
as the `Database` type for the Supabase client.

## 5. Run the app

```bash
npm run dev
```

Open `http://localhost:5173`.

## Database tests

The local stack supports pgTAP database tests:

```bash
npm run supabase:test
```

Tests are discovered from `supabase/migrations/` and `supabase/tests/`. This
command has **no tests yet** — see the gap note in
[docs/architecture.md](docs/architecture.md).

## Stopping the stack

```bash
npm run supabase:stop
```

## Troubleshooting

- **Port conflicts:** change ports in `supabase/config.toml` under `[api]`,
  `[db]`, `[studio]`, `[local_smtp]`.
- **"schema cache" errors after editing SQL:** restart the stack
  (`supabase stop && supabase start`) so PostgREST reloads the schema.
- **Migrations fail:** ensure `supabase/migrations/` contains only
  versioned `YYYYMMDDHHMMSS_*.sql` files and that no migration depends on
  state outside the repo.
