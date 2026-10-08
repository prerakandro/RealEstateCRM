import { supabase } from '@/lib/supabase'
import type {
  SiteVisit,
  SiteVisitInsert,
  SiteVisitStatus,
} from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export interface SiteVisitFilters {
  status?: SiteVisitStatus
  agentId?: string
  leadId?: string
  customerId?: string
  propertyId?: string
  /** Inclusive ISO lower bound on scheduled_at. */
  from?: string
  /** Exclusive ISO upper bound on scheduled_at. */
  to?: string
  limit?: number
}

export async function listSiteVisits(
  options?: SiteVisitFilters,
): Promise<SiteVisit[]> {
  let query = supabase
    .from('site_visits')
    .select('*')
    .order('scheduled_at', { ascending: true })
  if (options?.status) query = query.eq('status', options.status)
  if (options?.agentId) query = query.eq('agent_id', options.agentId)
  if (options?.leadId) query = query.eq('lead_id', options.leadId)
  if (options?.customerId) query = query.eq('customer_id', options.customerId)
  if (options?.propertyId) query = query.eq('property_id', options.propertyId)
  if (options?.from) query = query.gte('scheduled_at', options.from)
  if (options?.to) query = query.lt('scheduled_at', options.to)
  if (options?.limit) query = query.limit(options.limit)
  const { data, error } = await query
  throwIfError(error, 'Site visits could not be loaded.')
  return data ?? []
}

const activityLinks = (visit: SiteVisit) => ({
  lead_id: visit.lead_id,
  customer_id: visit.customer_id,
  property_id: visit.property_id,
})

// Scheduling a visit on an early-stage lead moves it to
// "site_visit_scheduled"; that happens in the database trigger.
export async function createSiteVisit(
  input: SiteVisitInsert,
): Promise<SiteVisit> {
  const { data, error } = await supabase
    .from('site_visits')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'The site visit could not be created.')
  if (!data) throw new ServiceError('The site visit could not be created.')
  await recordActivity(
    'site_visit',
    data.id,
    'site_visit_created',
    'Site visit scheduled',
    activityLinks(data),
  )
  return data
}

export async function updateSiteVisit(
  id: string,
  input: Partial<SiteVisitInsert>,
): Promise<SiteVisit> {
  const { data, error } = await supabase
    .from('site_visits')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The site visit could not be updated.')
  if (!data) throw new ServiceError('The site visit could not be updated.')
  await recordActivity(
    'site_visit',
    data.id,
    'site_visit_updated',
    `Site visit ${data.status.replaceAll('_', ' ')}`,
    activityLinks(data),
  )
  return data
}
