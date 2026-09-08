import { supabase } from '@/lib/supabase'
import type { DashboardStats } from '@/types/domain'
import { throwIfError } from './service-utils'

export async function getDashboardStats(): Promise<DashboardStats> {
  const [all, published, drafts, enquiries, agents] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('active', true),
  ])
  for (const result of [all, published, drafts, enquiries, agents]) throwIfError(result.error, 'Dashboard metrics could not be loaded.')
  return { totalProperties: all.count ?? 0, publishedProperties: published.count ?? 0, draftProperties: drafts.count ?? 0, newEnquiries: enquiries.count ?? 0, activeAgents: agents.count ?? 0 }
}
