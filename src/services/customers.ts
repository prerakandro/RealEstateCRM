import { supabase } from '@/lib/supabase'
import type {
  Customer,
  CustomerInsert,
  CustomerStatus,
  PaginatedResult,
} from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export interface CustomerFilters {
  query?: string
  status?: CustomerStatus
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
  if (filters.query)
    query = query.or(
      `full_name.ilike.%${filters.query}%,email.ilike.%${filters.query}%,phone.ilike.%${filters.query}%`,
    )
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
  return data
}
