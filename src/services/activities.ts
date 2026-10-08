import { supabase } from '@/lib/supabase'
import type { Activity } from '@/types/domain'
import type { Json } from '@/types/database.generated'
import { throwIfError } from './service-utils'

export interface ActivityFilters {
  entityType?: string
  entityId?: string
  userId?: string
  limit?: number
}

export async function listActivities(
  filters: ActivityFilters = {},
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.entityId) query = query.eq('entity_id', filters.entityId)
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.limit) query = query.limit(filters.limit)
  const { data, error } = await query
  throwIfError(error, 'Activity history could not be loaded.')
  return data ?? []
}

/**
 * History for one lead or customer: events on the record itself plus events
 * on follow-ups / site visits that link to it through metadata.
 */
export async function listTimeline(
  target: { leadId: string } | { customerId: string },
  limit = 50,
): Promise<Activity[]> {
  const [entityType, key, id] =
    'leadId' in target
      ? ['lead', 'lead_id', target.leadId]
      : ['customer', 'customer_id', target.customerId]
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .or(
      `and(entity_type.eq.${entityType},entity_id.eq.${id}),metadata->>${key}.eq.${id}`,
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  throwIfError(error, 'Activity history could not be loaded.')
  return data ?? []
}

export async function recordActivity(
  entityType: string,
  entityId: string,
  action: string,
  description: string,
  metadata: Json = {},
): Promise<void> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return
  const { error } = await supabase.from('activities').insert({
    user_id: user.user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    metadata,
  })
  throwIfError(error, 'The activity could not be recorded.')
}
