import { supabase } from '@/lib/supabase'
import type { FollowUp, FollowUpInsert, FollowUpStatus } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export interface FollowUpFilters {
  status?: FollowUpStatus
  assignedAgentId?: string
  leadId?: string
  customerId?: string
  overdue?: boolean
  /** Inclusive ISO lower bound on scheduled_at. */
  from?: string
  /** Exclusive ISO upper bound on scheduled_at. */
  to?: string
  limit?: number
}

export async function listFollowUps(
  options?: FollowUpFilters,
): Promise<FollowUp[]> {
  let query = supabase
    .from('follow_ups')
    .select('*')
    .order('scheduled_at', { ascending: true })
  if (options?.status) query = query.eq('status', options.status)
  if (options?.assignedAgentId)
    query = query.eq('assigned_agent_id', options.assignedAgentId)
  if (options?.leadId) query = query.eq('lead_id', options.leadId)
  if (options?.customerId) query = query.eq('customer_id', options.customerId)
  if (options?.overdue)
    query = query
      .lt('scheduled_at', new Date().toISOString())
      .eq('status', 'pending')
  if (options?.from) query = query.gte('scheduled_at', options.from)
  if (options?.to) query = query.lt('scheduled_at', options.to)
  if (options?.limit) query = query.limit(options.limit)
  const { data, error } = await query
  throwIfError(error, 'Follow-ups could not be loaded.')
  return data ?? []
}

const activityLinks = (followUp: FollowUp) => ({
  lead_id: followUp.lead_id,
  customer_id: followUp.customer_id,
})

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
    activityLinks(data),
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
    // The table only allows completed_at on completed rows.
    ...(input.status
      ? {
          completed_at:
            input.status === 'completed' ? new Date().toISOString() : null,
        }
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
    input.status ? `follow_up_${input.status}` : 'follow_up_updated',
    input.status
      ? `Follow-up ${input.status}: ${data.title}`
      : `Follow-up updated: ${data.title}`,
    activityLinks(data),
  )
  return data
}
