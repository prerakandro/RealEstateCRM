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
  customerId?: string
  propertyId?: string
  /** Only leads that are still being worked (not converted/lost/closed). */
  openOnly?: boolean
  /** ISO date (inclusive) / ISO date (exclusive) bounds on created_at. */
  createdFrom?: string
  createdTo?: string
  minBudget?: number
  maxBudget?: number
  /** overdue: next follow-up in the past; none: no pending follow-up. */
  followUp?: 'overdue' | 'none'
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
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.propertyId) query = query.eq('property_id', filters.propertyId)
  if (filters.openOnly)
    query = query.not('status', 'in', '(converted,lost,closed)')
  if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom)
  if (filters.createdTo) query = query.lt('created_at', filters.createdTo)
  if (filters.minBudget !== undefined)
    query = query.gte('expected_budget', filters.minBudget)
  if (filters.maxBudget !== undefined)
    query = query.lte('expected_budget', filters.maxBudget)
  if (filters.followUp === 'overdue')
    query = query.lt('next_follow_up_at', new Date().toISOString())
  if (filters.followUp === 'none') query = query.is('next_follow_up_at', null)
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
    { lead_id: data.id, customer_id: data.customer_id },
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
    input.status
      ? `Lead moved to ${input.status.replaceAll('_', ' ')}`
      : 'Lead details updated',
    { status: data.status, lead_id: data.id, customer_id: data.customer_id },
  )
  return data
}
