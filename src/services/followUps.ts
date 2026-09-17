import { supabase } from '@/lib/supabase'
import type { FollowUp, FollowUpInsert, FollowUpStatus } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export async function listFollowUps(options?: {
  status?: FollowUpStatus
  assignedAgentId?: string
  overdue?: boolean
}): Promise<FollowUp[]> {
  let query = supabase
    .from('follow_ups')
    .select('*')
    .order('scheduled_at', { ascending: true })
  if (options?.status) query = query.eq('status', options.status)
  if (options?.assignedAgentId)
    query = query.eq('assigned_agent_id', options.assignedAgentId)
  if (options?.overdue)
    query = query
      .lt('scheduled_at', new Date().toISOString())
      .eq('status', 'pending')
  const { data, error } = await query
  throwIfError(error, 'Follow-ups could not be loaded.')
  return data ?? []
}

export async function createFollowUp(input: FollowUpInsert): Promise<FollowUp> {
  const { data, error } = await supabase
    .from('follow_ups')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'The follow-up could not be created.')
  if (!data) throw new ServiceError('The follow-up could not be created.')
  await recordActivity(
    'follow_up',
    data.id,
    'follow_up_created',
    `Follow-up created: ${data.title}`,
  )
  return data
}

export async function updateFollowUp(
  id: string,
  input: Partial<FollowUpInsert>,
): Promise<FollowUp> {
  const update = {
    ...input,
    updated_at: new Date().toISOString(),
    ...(input.status === 'completed'
      ? { completed_at: new Date().toISOString() }
      : {}),
  }
  const { data, error } = await supabase
    .from('follow_ups')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The follow-up could not be updated.')
  if (!data) throw new ServiceError('The follow-up could not be updated.')
  await recordActivity(
    'follow_up',
    data.id,
    input.status === 'completed' ? 'follow_up_completed' : 'follow_up_updated',
    `Follow-up ${input.status === 'completed' ? 'completed' : 'updated'}`,
  )
  return data
}
