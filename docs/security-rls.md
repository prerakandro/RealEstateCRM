# Security and RLS model

This document defines the authorization model for the CRM. It is a
specification for SQL that does not yet exist — see
[docs/architecture.md](docs/architecture.md) for the current gap list.

## Roles

| Role            | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| `anon`          | Unauthenticated visitor; public listing read only    |
| `authenticated` | Signed-in user; scoped by RLS to their own data      |
| `service_role`  | Server-side only; bypasses RLS. Never in the browser |

`public.profile_role` is `admin | agent`. The `profiles.role` column decides
staff permissions.

## Client setup

The browser gets only the anon (publishable) key:

```ts
// src/lib/supabase.ts
createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

The service-role key and JWT signing key live in `supabase/.env.local`
(encrypted, git-ignored) and are consumed only by migrations and Edge
Functions.

## RLS policy template

Enable RLS on every table, then add one policy per operation:

```sql
alter table public.properties enable row level security;

-- Anon: published listings only (enforced by the public RPC, not a broad select)
create policy properties_public_select on public.properties
  for select to anon
  using (status = 'published');

-- Authenticated agent: own listings
create policy properties_agent_select on public.properties
  for select to authenticated
  using (auth.uid() = created_by);

create policy properties_agent_insert on public.properties
  for insert to authenticated
  with check (auth.uid() = created_by);

create policy properties_agent_update on public.properties
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Admin: full access
create policy properties_admin_all on public.properties
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

Helper functions:

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'agent') = 'admin'
$$;
```

`property_images` follows the same pattern, keyed on the owning property's
`created_by`. Storage bucket policies are separate — see
[docs/hosted-supabase.md](docs/hosted-supabase.md).

## First-admin bootstrap

There is no bootstrap today. Implement one of these before launch:

Option A — migration trigger on `auth.users`:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'agent',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Option B — bootstrap the first admin by hand after the project is created:

```sql
update public.profiles set role = 'admin' where email = 'hello@havenandkey.com';
```

Do not rely on option B alone in production: if the first admin account is
deleted, there is no recovery path. Prefer option A plus a one-time manual
promotion.

## Invite-agent Edge Function

The invite flow sends an agent an email with a signup link. It needs to:

1. Verify a shared secret (`INVITE_AGENT_SECRET`) on every request. Reject
   unauthenticated invocations; the browser must never hold this secret.
2. Optionally set `auth.email.template.invite` in `config.toml` so the
   invite email uses a branded template.
3. Call `supabase.auth.admin.inviteUserByEmail` from the server-side function
   (service role), passing `redirectTo` set to the production site URL.
4. Insert a `profiles` row with `role = 'agent'` if one does not exist.

`supabase/functions/invite-agent/index.ts` (not yet written):

```ts
import { createServerClient } from '@supabase/server' // or supabase-js service role
import { Deno } from 'https://deno.land/std@0.224.0/env/mod.ts'

const APP_SECRET = Deno.env.get('INVITE_AGENT_SECRET')!

export default async function (req: Request) {
  if (req.headers.get('x-invite-secret') !== APP_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { email, role = 'agent' } = await req.json()
  const supabase = createServerClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SECRET_KEYS')!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: Deno.env.get('SITE_URL')!,
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  await supabase.from('profiles').upsert({ id: data.user.id, email, role })
  return Response.json({ ok: true })
}
```

Set the secret after deployment:

```bash
supabase secrets set INVITE_AGENT_SECRET=***
```

## Secret hygiene checklist

- Service-role and signing keys: only in `supabase/.env.local`, encrypted.
- Edge Function secrets: set with `supabase secrets set`; no redeployment
  required; never logged.
- SMTP credentials: `env(SENDGRID_API_KEY)` style references in
  `config.toml`, never inline values.
- OAuth provider secrets: `env(SUPABASE_AUTH_EXTERNAL_*_SECRET)`.
- `.env` (Vite): browser-safe `VITE_*` variables only.
