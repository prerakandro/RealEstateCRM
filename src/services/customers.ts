import { supabase } from '@/lib/supabase'
import type {
  Customer,
  CustomerInsert,
  CustomerStatus,
  CustomerType,
  PaginatedResult,
} from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'
import { recordActivity } from './activities'

export interface CustomerFilters {
  query?: string
  status?: CustomerStatus
  type?: CustomerType
  assignedAgentId?: string
  page: number
  pageSize: number
}

export async function listCustomers(
  filters: CustomerFilters,
): Promise<PaginatedResult<Customer>> {
  const start = (filters.page - 1) * filters.pageSize
  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(start, start + filters.pageSize - 1)
  if (filters.status) query = query.eq('customer_status', filters.status)
  if (filters.type) query = query.eq('customer_type', filters.type)
  if (filters.assignedAgentId)
    query = query.eq('assigned_agent_id', filters.assignedAgentId)
  if (filters.query) {
    // Commas and parentheses would break PostgREST's or() syntax.
    const term = filters.query.replace(/[,()]/g, ' ').trim()
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,preferred_location.ilike.%${term}%`,
    )
  }
  const { data, error, count } = await query
  throwIfError(error, 'Customers could not be loaded.')
  const total = count ?? 0
  return {
    data: data ?? [],
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  throwIfError(error, 'The customer could not be loaded.')
  if (!data) throw new ServiceError('The customer could not be loaded.')
  return data
}

export async function createCustomer(input: CustomerInsert): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'The customer could not be created.')
  if (!data) throw new ServiceError('The customer could not be created.')
  await recordActivity(
    'customer',
    data.id,
    'customer_created',
    `Customer added: ${data.full_name}`,
    { customer_id: data.id },
  )
  return data
}

export async function updateCustomer(
  id: string,
  input: Partial<CustomerInsert>,
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The customer could not be updated.')
  if (!data) throw new ServiceError('The customer could not be updated.')
  await recordActivity(
    'customer',
    data.id,
    'customer_updated',
    input.assigned_agent_id !== undefined
      ? 'Customer reassigned'
      : 'Customer details updated',
    { customer_id: data.id },
  )
  return data
}
