import { supabase } from '@/lib/supabase'
import type { DashboardStats } from '@/types/domain'
import { throwIfError } from './service-utils'

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    all,
    published,
    drafts,
    enquiries,
    agents,
    customers,
    leads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    pendingFollowUps,
    todayFollowUps,
    overdueFollowUps,
    upcomingSiteVisits,
    completedSiteVisits,
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'qualified'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'converted'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lost'),
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte(
        'scheduled_at',
        new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      )
      .lt(
        'scheduled_at',
        new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
      ),
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('scheduled_at', new Date().toISOString()),
    supabase
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_at', new Date().toISOString()),
    supabase
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed'),
  ])
  for (const result of [
    all,
    published,
    drafts,
    enquiries,
    agents,
    customers,
    leads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    pendingFollowUps,
    todayFollowUps,
    overdueFollowUps,
    upcomingSiteVisits,
    completedSiteVisits,
  ])
    throwIfError(result.error, 'Dashboard metrics could not be loaded.')
  return {
    totalProperties: all.count ?? 0,
    publishedProperties: published.count ?? 0,
    draftProperties: drafts.count ?? 0,
    newEnquiries: enquiries.count ?? 0,
    activeAgents: agents.count ?? 0,
    totalCustomers: customers.count ?? 0,
    totalLeads: leads.count ?? 0,
    newLeads: newLeads.count ?? 0,
    qualifiedLeads: qualifiedLeads.count ?? 0,
    convertedLeads: convertedLeads.count ?? 0,
    lostLeads: lostLeads.count ?? 0,
    pendingFollowUps: pendingFollowUps.count ?? 0,
    todayFollowUps: todayFollowUps.count ?? 0,
    overdueFollowUps: overdueFollowUps.count ?? 0,
    upcomingSiteVisits: upcomingSiteVisits.count ?? 0,
    completedSiteVisits: completedSiteVisits.count ?? 0,
  }
}
