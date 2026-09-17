import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database.generated'

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-client-info': 'estate-flow-web/1.0.0',
      },
    },
  },
)
