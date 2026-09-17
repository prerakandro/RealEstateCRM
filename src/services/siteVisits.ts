import { supabase } from '@/lib/supabase'
import type {
  SiteVisit,
  SiteVisitInsert,
  SiteVisitStatus,
} from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export async function listSiteVisits(options?: {
  status?: SiteVisitStatus
  agentId?: string
}): Promise<SiteVisit[]> {
  let query = supabase
    .from('site_visits')
    .select('*')
    .order('scheduled_at', { ascending: true })
  if (options?.status) query = query.eq('status', options.status)
  if (options?.agentId) query = query.eq('agent_id', options.agentId)
  const { data, error } = await query
  throwIfError(error, 'Site visits could not be loaded.')
  return data ?? []
}

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
    `Site visit ${data.status}`,
  )
  return data
}
