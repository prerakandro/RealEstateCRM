# Architecture

Haven & Key is a client-rendered single-page application (SPA) on top of
Supabase. There is no server-rendered backend: all business logic that is not
in Postgres runs in the browser.

## High-level shape

```
┌────────────────────────────────────────────────────────────┐
│ Vercel (SPA)                                                │
│  dist/index.html  →  assets/*.js, *.css, icons, favicons   │
└──────┬──────────────────────────┬───────────────────────────┘
       │ HTTPS (anon key)         │ HTTPS (anon key)
       ▼                          ▼
┌─────────────────────┐   ┌──────────────────────────────────┐
│ Supabase API        │   │ Supabase Edge Functions (Deno 2)  │
│  REST / GraphQL     │   │  invite-agent, lifecycle hooks    │
│  Auth               │   │  (verify INVITE_AGENT_SECRET)     │
│  Storage            │   │                                  │
│  Realtime           │   └──────────────────────────────────┘
└──────┬──────────────┘
       │ TCP / pooler
       ▼
┌────────────────────────────────────────────────────────────┐
│ Postgres 17                                                 │
│  public.profiles  ·  properties  ·  property_images        │
│  ·  enquiries  ·  search_properties / publish_property ... │
└────────────────────────────────────────────────────────────┘
```

## Request flow

1. **Public listing.** The browser calls `supabase.rpc('search_properties', ...)`.
   The RPC filters `status = 'published'` and returns a page of denormalized
   rows including `primary_image_path`. The client resolves each path to a
   public URL through `supabase.storage.from('property-images').getPublicUrl`.
2. **Property detail.** `getPublicPropertyBySlug` selects the property, its
   ordered images, and the listing agent's profile in parallel.
3. **Staff workspace.** `listStaffProperties` paginates all properties (any
   status) and fetches each primary image in a single `in` query.
4. **Image upload.** `uploadPropertyImage` compresses to <= 1.5 MB / 2400 px,
   reserves a path via `reserve_property_image` (with a client-side fallback
   insert), then uploads to a signed URL (with a plain `.upload` fallback).
5. **Lifecycle.** `publishProperty` / `archiveProperty` / `restoreProperty`
   delegate to Postgres RPCs so the status transition is enforced server-side.

## Data model

Declared in `src/types/database.generated.ts` (manually authored; replace
with `npm run supabase:types` once a linked schema exists).

| Table             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `profiles`        | One row per Supabase Auth user; `role` = `admin` \| `agent`    |
| `properties`      | Listings with slug, lifecycle status, price, address, agent   |
| `property_images` | Ordered photo set per property; `storage_path` into bucket    |
| `enquiries`       | Lead submissions with status pipeline and assignment          |

RPCs the frontend depends on: `search_properties`,
`reserve_property_image`, `set_primary_property_image`,
`reorder_property_images`, `publish_property`, `archive_property`,
`restore_property`.

## Realtime

Supabase Realtime is enabled in `supabase/config.toml`
(`[realtime] enabled = true`). The staff workspace listens to
`property_images` and `properties` changes so a listing edited by a colleague
appears without a refresh.

## Where the backend is NOT yet implemented

This is the honest gap list. The frontend calls the APIs below; none of them
exist as SQL yet.

- **No migrations.** `supabase/config.toml` sets `schema_paths = []`, so
  `supabase db push` applies nothing. There is no `supabase/migrations/`
  directory, no `schema.sql`, and no `seed.sql` (the seed path is declared
  but the file is missing).
- **No RLS.** No `create policy` statements exist for any table. Until they
  are written, the anon key can read and write everything.
- **No RPC implementations.** `search_properties`, the image reservation and
  ordering RPCs, and the lifecycle RPCs are declared in TypeScript only.
- **No first-admin bootstrap.** There is no trigger on `auth.users`, no
  `before_user_created` hook, and no seed that creates an admin profile.
- **No Edge Functions.** There is no `supabase/functions/` directory, so the
  invite-agent function does not exist.
- **No storage bucket.** The client uses the `property-images` bucket
  unconditionally; it is not declared in config or SQL.

Until these exist, `npm run supabase:reset` produces an empty database and
every frontend call fails with a relation-does-not-exist error. Treat the
declared types as the target schema, not the current one.

## Design notes

- **No framework-level auth guard.** Authorization is data-side: RLS policies
  on `properties` and `property_images` enforce that an agent sees only their
  own listings, and a public `search_properties` RPC filters to published
  rows for anon callers.
- **Image path ownership.** `property_images.storage_path` is the join key
  between the database and the object store. It must be written by the
  reservation RPC (or the client fallback) and never edited directly with SQL,
  or the object store and metadata diverge.
- **Compression is client-side.** `browser-image-compression` caps uploads at
  1.5 MB before they reach Supabase Storage, which keeps the global
  `file_size_limit = "50MiB"` as a backstop rather than the active limit.