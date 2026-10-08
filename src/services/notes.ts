import { supabase } from '@/lib/supabase'
import type { CrmNote } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export async function listNotes(filters: {
  customerId?: string
  leadId?: string
}): Promise<CrmNote[]> {
  let query = supabase
    .from('crm_notes')
    .select('*')
    .order('created_at', { ascending: false })
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.leadId) query = query.eq('lead_id', filters.leadId)
  const { data, error } = await query
  throwIfError(error, 'Notes could not be loaded.')
  return data ?? []
}

export async function addNote(input: {
  customerId: string
  leadId?: string | null
  body: string
  authorId: string
}): Promise<CrmNote> {
  const { data, error } = await supabase
    .from('crm_notes')
    .insert({
      customer_id: input.customerId,
      lead_id: input.leadId ?? null,
      body: input.body.trim(),
      created_by: input.authorId,
    })
    .select('*')
    .single()
  throwIfError(error, 'The note could not be saved.')
  if (!data) throw new ServiceError('The note could not be saved.')
  return data
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('crm_notes').delete().eq('id', id)
  throwIfError(error, 'The note could not be deleted.')
}
