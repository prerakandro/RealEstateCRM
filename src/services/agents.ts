import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export interface AgentInput {
  id?: string
  full_name: string
  email: string
  phone?: string | null
  avatar_url?: string | null
  role: 'admin' | 'agent'
  active: boolean
}

export async function listAgents(options?: {
  activeOnly?: boolean
}): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('full_name')
  if (options?.activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  throwIfError(error, 'Agents could not be loaded.')
  return data ?? []
}

export async function getAgent(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  throwIfError(error, 'The agent could not be loaded.')
  if (!data) throw new ServiceError('The agent could not be loaded.')
  return data
}

export async function createAgent(input: AgentInput): Promise<Profile> {
  if (!input.id) {
    throw new ServiceError(
      'Create the user in Supabase Authentication first, then add the matching profile ID.',
    )
  }
  const { data, error } = await supabase
    .from('profiles')
    .insert({ ...input, id: input.id })
    .select('*')
    .single()
  throwIfError(error, 'The agent could not be added.')
  if (!data) throw new ServiceError('The agent could not be added.')
  return data
}

export async function updateAgent(
  id: string,
  input: Partial<AgentInput>,
): Promise<Profile> {
  const { id: _id, ...update } = input
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The agent could not be updated.')
  if (!data) throw new ServiceError('The agent could not be updated.')
  return data
}

export async function setAgentActive(
  id: string,
  active: boolean,
): Promise<Profile> {
  return updateAgent(id, { active })
}

export async function inviteAgent(
  input: Pick<AgentInput, 'full_name' | 'email' | 'phone' | 'role'>,
): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-agent', {
    body: input,
  })
  throwIfError(error, 'The agent invitation could not be sent.')
}
