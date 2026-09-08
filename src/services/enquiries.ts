import { supabase } from '@/lib/supabase'
import type { Enquiry, EnquiryInsert } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export async function createEnquiry(input: EnquiryInsert): Promise<Enquiry> {
  const { data, error } = await supabase.from('enquiries').insert(input).select('*').single()
  throwIfError(error, 'Your enquiry could not be sent. Please try again.')
  if (!data) throw new ServiceError('Your enquiry could not be sent. Please try again.')
  return data
}

export async function listEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false })
  throwIfError(error, 'Enquiries could not be loaded.')
  return data ?? []
}

export async function updateEnquiryStatus(id: string, status: Enquiry['status']): Promise<void> {
  const { error } = await supabase.from('enquiries').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  throwIfError(error, 'The enquiry could not be updated.')
}
