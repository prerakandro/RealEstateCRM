import { supabase } from '@/lib/supabase'
import { throwIfError } from './service-utils'

export type NameMap = Record<string, string>

const unique = (ids: Array<string | null | undefined>) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
]

/** Customer names for the given ids (only the ones RLS lets the user see). */
export async function getCustomerNames(
  ids: Array<string | null | undefined>,
): Promise<NameMap> {
  const wanted = unique(ids)
  if (!wanted.length) return {}
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name')
    .in('id', wanted)
  throwIfError(error, 'Customer names could not be loaded.')
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.full_name]))
}

/** Property titles for the given ids. */
export async function getPropertyTitles(
  ids: Array<string | null | undefined>,
): Promise<NameMap> {
  const wanted = unique(ids)
  if (!wanted.length) return {}
  const { data, error } = await supabase
    .from('properties')
    .select('id, title')
    .in('id', wanted)
  throwIfError(error, 'Property titles could not be loaded.')
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.title]))
}

export interface Option {
  id: string
  label: string
}

/** Customers for pickers, optionally narrowed by a search term. */
export async function listCustomerOptions(query = ''): Promise<Option[]> {
  let request = supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .order('full_name')
    .limit(50)
  const term = query.replace(/[,()]/g, ' ').trim()
  if (term)
    request = request.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    )
  const { data, error } = await request
  throwIfError(error, 'Customers could not be loaded.')
  return (data ?? []).map((row) => ({
    id: row.id,
    label: [row.full_name, row.phone || row.email].filter(Boolean).join(' · '),
  }))
}

/** Non-archived listings for pickers (site visits, leads). */
export async function listPropertyOptions(): Promise<Option[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, title, city, status')
    .neq('status', 'archived')
    .order('title')
    .limit(500)
  throwIfError(error, 'Properties could not be loaded.')
  return (data ?? []).map((row) => ({
    id: row.id,
    label: `${row.title} · ${row.city}${row.status === 'draft' ? ' (draft)' : ''}`,
  }))
}
