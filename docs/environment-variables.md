# Environment variables

The app uses Vite's import-meta-env model: only `VITE_*` prefixed variables are
embedded into the client bundle at build time. The app validates them at
startup with Zod (`src/lib/env.ts`) and falls back to safe local defaults in
development. A missing `VITE_SUPABASE_URL` in production silently resolves to
`http://127.0.0.1:54321` — configure it explicitly in every environment.

## Browser-safe variables (client bundle)

Copy `.env.example` to `.env`. Never add a secret or service-role key here.

| Variable                 | Purpose                                                  | Example                           |
| ------------------------ | -------------------------------------------------------- | --------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project API URL                                 | `https://yourproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable client key (safe to expose)                  | `sb_publishable_...`              |
| `VITE_SITE_URL`          | Canonical origin used for absolute URLs and SEO metadata | `https://www.havenandkey.com`     |

`.env` and `.env.*` are git-ignored; `.env.example` is committed.

## Supabase CLI secrets (server-side, never committed)

The CLI stores these in the encrypted `supabase/.env.local` file, which is
git-ignored. They are used for migrations, `db push`, and Edge Function
deployment.

| Variable                | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | `supabase login` session token                              |
| `SUPABASE_DB_PASSWORD`  | Remote database password for `supabase db push` / `db dump` |
| `SUPABASE_PROJECT_REF`  | Project reference for `supabase link`                       |

## Edge Function secrets

Set with `supabase secrets set` (stored server-side; no redeployment
required):

```bash
supabase secrets set \
  SMTP_HOST=smtp.example.com \
  SMTP_PORT=587 \
  SMTP_USER=apikey \
  SMTP_PASS=env(SENDGRID_API_KEY) \
  SENDGRID_API_KEY=*** \
  INVITE_AGENT_SECRET=***
```

The invite-agent function must verify `INVITE_AGENT_SECRET` on every request
and never accept it from the browser. See
[docs/security-rls.md](docs/security-rls.md).

## Environment-specific values

### Local development

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
VITE_SITE_URL=http://localhost:5173
```

### Staging / preview

```env
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging-publishable-key>
VITE_SITE_URL=https://staging.havenandkey.com
```

### Production

```env
VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod-publishable-key>
VITE_SITE_URL=https://www.havenandkey.com
```

Vercel injects these per environment through the project settings; the
`VITE_` prefix is required for Vite to inline them.

## Validation

`src/lib/env.ts` parses `import.meta.env` against a Zod schema. In `DEV` mode
a parse failure prints a warning; in production a failure silently falls back
to defaults. Add an explicit build-time guard if you want a failed build when
variables are missing:

```ts
// src/lib/env.ts (optional hardening)
if (import.meta.env.PROD && !env.isSupabaseConfigured) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in production.',
  )
}
```
