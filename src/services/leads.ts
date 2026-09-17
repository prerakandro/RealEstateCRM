import { supabase } from '@/lib/supabase'
import type {
  Lead,
  LeadInsert,
  LeadPriority,
  LeadSource,
  LeadStatus,
  PaginatedResult,
} from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export interface LeadFilters {
  query?: string
  status?: LeadStatus
  priority?: LeadPriority
  source?: LeadSource
  assignedAgentId?: string
  page: number
  pageSize: number
}

export async function listLeads(
  filters: LeadFilters,
): Promise<PaginatedResult<Lead>> {
  const start = (filters.page - 1) * filters.pageSize
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(start, start + filters.pageSize - 1)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.source) query = query.eq('source', filters.source)
  if (filters.assignedAgentId)
    query = query.eq('assigned_agent_id', filters.assignedAgentId)
  if (filters.query) query = query.ilike('title', `%${filters.query}%`)
  const { data, error, count } = await query
  throwIfError(error, 'Leads could not be loaded.')
  const total = count ?? 0
  return {
    data: data ?? [],
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

export async function getLead(id: string): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()
  throwIfError(error, 'The lead could not be loaded.')
  if (!data) throw new ServiceError('The lead could not be loaded.')
  return data
}

export async function createLead(input: LeadInsert): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'The lead could not be created.')
  if (!data) throw new ServiceError('The lead could not be created.')
  await recordActivity(
    'lead',
    data.id,
    'lead_created',
    `Lead created: ${data.title}`,
  )
  return data
}

export async function updateLead(
  id: string,
  input: Partial<LeadInsert>,
): Promise<Lead> {
  const next = { ...input, updated_at: new Date().toISOString() }
  if (input.status === 'contacted')
    Object.assign(next, { contacted_at: new Date().toISOString() })
  if (input.status === 'qualified')
    Object.assign(next, { qualified_at: new Date().toISOString() })
  if (input.status === 'converted')
    Object.assign(next, { converted_at: new Date().toISOString() })
  const { data, error } = await supabase
    .from('leads')
    .update(next)
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The lead could not be updated.')
  if (!data) throw new ServiceError('The lead could not be updated.')
  await recordActivity(
    'lead',
    data.id,
    input.status ? 'lead_status_changed' : 'lead_updated',
    input.status ? `Lead moved to ${input.status}` : 'Lead details updated',
    { status: data.status },
  )
  return data
}
