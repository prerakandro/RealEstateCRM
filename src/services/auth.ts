import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  throwIfError(error, 'Unable to sign in.')
  if (!data.session) throw new ServiceError('Unable to sign in.')
  return data.session
}

export async function signUp(fullName: string, email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  throwIfError(error, 'Unable to create your account.')
  if (!data.user) throw new ServiceError('Unable to create your account.')
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  throwIfError(error, 'Unable to sign out.')
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  throwIfError(authError, 'Unable to load your account.')
  if (!auth.user) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle()
  throwIfError(error, 'Unable to load your account.')
  return data
}
