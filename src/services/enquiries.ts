import { supabase } from '@/lib/supabase'
import type { Enquiry, EnquiryInsert } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export async function createEnquiry(input: EnquiryInsert): Promise<Enquiry> {
  const { data, error } = await supabase
    .from('enquiries')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'Your enquiry could not be sent. Please try again.')
  if (!data)
    throw new ServiceError('Your enquiry could not be sent. Please try again.')
  const { error: workflowError } = await supabase.rpc(
    'create_public_enquiry_lead',
    {
      p_property_id: input.property_id ?? null,
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone ?? null,
      p_message: input.message,
    },
  )
  throwIfError(
    workflowError,
    'Your enquiry was received but could not enter the CRM.',
  )
  return data
}

export async function listEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
  throwIfError(error, 'Enquiries could not be loaded.')
  return data ?? []
}

export async function updateEnquiryStatus(
  id: string,
  status: Enquiry['status'],
): Promise<void> {
  const { error } = await supabase
    .from('enquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  throwIfError(error, 'The enquiry could not be updated.')
}
