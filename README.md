# Haven & Key — Real Estate CRM

A Vite + React + TypeScript + Tailwind single-page application for listing and
managing residential properties, backed by Supabase (Postgres, Auth, Storage,
Realtime, and Edge Functions).

**Status:** greenfield. This repository contains the frontend scaffold, the
Supabase configuration, and the declared TypeScript types for the backend.
The database schema, Row Level Security policies, Edge Functions, and seed
data are not yet implemented. See [docs/architecture.md](docs/architecture.md)
for the current gap between declared types and deployed SQL.

## Features

- Public property search and detail pages (client-side routing)
- Staff property workspace with draft / published / archived lifecycle
- Signed-URL image upload with client-side compression (max 1.5 MB, 2400 px)
- Supabase Auth with email confirmations, password resets, and session refresh
- Realtime subscriptions for live listing updates
- Accessible, semantic markup (Oxlint + Prettier + Playwright axe checks)

## Tech stack

| Layer        | Tool / Library                                   |
| ------------ | ------------------------------------------------ |
| Framework    | React 19, React Router DOM 7                     |
| Build        | Vite 8, Tailwind CSS 4, `@tailwindcss/vite`      |
| Language     | TypeScript 6, Zod 4, Oxlint                      |
| Testing      | Vitest 5 (unit), Playwright 1.63 + axe-core (e2e) |
| Backend      | Supabase (Postgres 17, Auth, Storage, Edge Functions) |
| Deployment   | Vercel (SPA)                                     |
| Styling      | Prettier 3 + prettier-plugin-tailwindcss         |

## Quick start

```bash
# 1. Install dependencies (Node >= 20.19.0)
npm install

# 2. Copy the local environment template and start the Supabase local stack
cp .env.example .env
npm run supabase:start

# 3. Generate TypeScript types from the local schema
npm run supabase:types

# 4. Development server
npm run dev
```

The app serves at `http://localhost:5173`. Supabase Studio is available at
`http://localhost:54323` and the local email testing inbox at
`http://localhost:54324`.

## Scripts

| Script                 | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Vite dev server with HMR                                |
| `npm run build`        | `tsc -b && vite build`                                  |
| `npm run preview`      | Serve the production build locally                      |
| `npm run typecheck`    | TypeScript project references                            |
| `npm run lint`         | Oxlint                                                  |
| `npm run format:check` | Prettier check                                          |
| `npm run test`         | `vitest run`                                            |
| `npm run test:coverage`| Vitest coverage report                                  |
| `npm run test:e2e`     | `playwright test`                                       |
| `npm run check`        | format + lint + typecheck + test + build (full gate)    |
| `npm run supabase:start` / `:stop` / `:reset` | Local Supabase stack |
| `npm run supabase:test`| `supabase test db` (pgTAP)                              |
| `npm run supabase:types`| Generate `src/types/database.generated.ts`             |

## Environment variables

See [docs/environment-variables.md](docs/environment-variables.md). Public
variables only — never commit secrets or service-role keys. Copy
`.env.example` to `.env` (git-ignored).

## Local development

See [docs/local-setup.md](docs/local-setup.md) for the full Supabase CLI
workflow, including migrations, seeding, and the local email inbox.

## Production deployment

See [docs/hosted-supabase.md](docs/hosted-supabase.md) for the hosted Supabase
deployment path, Auth configuration, Storage, and backup/rollback operations.

## Security and RLS model

See [docs/security-rls.md](docs/security-rls.md) for the role model, RLS
policy template, first-admin bootstrap, and the invite-agent Edge Function.

## CI / CD

See [docs/ci-cd.md](docs/ci-cd.md) for the GitHub Actions pipeline.

## SEO

See [docs/seo.md](docs/seo.md) for structured data, meta tags, and the honest
limitations of a client-rendered SPA.

## License

See [LICENSE](LICENSE).# RealEstateCRM
