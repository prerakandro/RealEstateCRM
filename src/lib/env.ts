import { z } from 'zod'

const environmentSchema = z.object({
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SITE_URL: z.url().optional(),
})

const parsed = environmentSchema.safeParse(import.meta.env)

if (!parsed.success && import.meta.env.DEV) {
  console.warn(
    'Some public environment variables are invalid.',
    parsed.error.flatten(),
  )
}

const values = parsed.success ? parsed.data : {}
const hasSupabaseUrl = Boolean(values.VITE_SUPABASE_URL)
const hasSupabaseKey = Boolean(values.VITE_SUPABASE_ANON_KEY)

export const env = {
  supabaseUrl: values.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabaseAnonKey: values.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key',
  siteUrl: values.VITE_SITE_URL ?? window.location.origin,
  isSupabaseConfigured: hasSupabaseUrl && hasSupabaseKey,
} as const
