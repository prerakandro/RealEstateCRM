import type {
  Customer,
  CustomerStatus,
  CustomerType,
  FollowUpStatus,
  FollowUpType,
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  Notification,
  PropertySearchFilters,
  SiteVisitStatus,
} from '@/types/domain'

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'site_visit_scheduled',
  'negotiation',
  'converted',
  'lost',
  'closed',
]
export const CLOSED_LEAD_STATUSES: LeadStatus[] = [
  'converted',
  'lost',
  'closed',
]
export const LEAD_PRIORITIES: LeadPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
]
export const LEAD_SOURCES: LeadSource[] = [
  'website',
  'property_enquiry',
  'referral',
  'phone',
  'walk_in',
  'social_media',
  'other',
]
export const CUSTOMER_TYPES: CustomerType[] = [
  'buyer',
  'tenant',
  'investor',
  'seller',
  'other',
]
export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'new',
  'active',
  'converted',
  'inactive',
  'closed',
]
export const FOLLOW_UP_TYPES: FollowUpType[] = [
  'call',
  'whatsapp',
  'email',
  'meeting',
  'other',
]
export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  'pending',
  'completed',
  'cancelled',
  'missed',
]
export const SITE_VISIT_STATUSES: SiteVisitStatus[] = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
]
export const CURRENCIES = ['INR', 'USD', 'AED', 'GBP', 'EUR']

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming' | 'closed'

/** Where a follow-up sits in an agent's day. */
export function followUpBucket(
  scheduledAt: string,
  status: FollowUpStatus,
  now = new Date(),
): FollowUpBucket {
  if (status !== 'pending') return 'closed'
  const when = new Date(scheduledAt)
  if (when < now) return 'overdue'
  if (when.toDateString() === now.toDateString()) return 'today'
  return 'upcoming'
}

/** Published-listing search built from a customer's saved preferences. */
export function customerSearchFilters(
  customer: Customer,
  pageSize = 6,
): PropertySearchFilters {
  const location = customer.preferred_location?.split(',')[0]?.trim()
  return {
    query: location || undefined,
    propertyType: customer.preferred_property_type ?? undefined,
    listingType: customer.preferred_listing_type ?? undefined,
    minPrice: customer.budget_min ?? undefined,
    maxPrice: customer.budget_max ?? undefined,
    bedrooms: customer.bedrooms_required ?? undefined,
    page: 1,
    pageSize,
  }
}

export function hasMatchCriteria(customer: Customer): boolean {
  return Boolean(
    customer.preferred_location?.trim() ||
    customer.preferred_property_type ||
    customer.preferred_listing_type ||
    customer.budget_min != null ||
    customer.budget_max != null ||
    customer.bedrooms_required != null,
  )
}

/** Comma- or line-separated amenities, trimmed and de-duplicated. */
export function parseAmenities(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(/[,\n]/)) {
    const item = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!item || seen.has(item.toLowerCase())) continue
    seen.add(item.toLowerCase())
    result.push(item)
  }
  return result.slice(0, 30)
}

export function copySlug(slug: string, suffix: string): string {
  return `${slug.replace(/-copy-[a-z0-9]+$/, '')}-copy-${suffix}`
}

export function groupLeadsByStatus(leads: Lead[]): Record<LeadStatus, Lead[]> {
  const groups = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, [] as Lead[]]),
  ) as Record<LeadStatus, Lead[]>
  for (const lead of leads) groups[lead.status]?.push(lead)
  return groups
}

/** ISO timestamp → value for an `<input type="datetime-local">`. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** `<input type="datetime-local">` value → ISO timestamp (or null). */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Optional non-negative number from a form field. */
export function optionalNumber(
  value: FormDataEntryValue | null,
): number | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function optionalText(value: FormDataEntryValue | null): string | null {
  return String(value ?? '').trim() || null
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/** Where a notification should take the user when opened. */
export function notificationLink(item: Notification): string | null {
  if (!item.entity_id) return null
  switch (item.entity_type) {
    case 'lead':
      return `/crm/leads/${item.entity_id}`
    case 'customer':
      return `/crm/customers/${item.entity_id}`
    case 'profile':
      return '/crm/agents'
    case 'follow_up':
      return '/crm/follow-ups?view=all'
    case 'site_visit':
      return '/crm/site-visits?view=all'
    default:
      return null
  }
}

/** Short rupee amount in lakh / crore, e.g. 4500000 -> "₹45 L". */
export function formatINRShort(value: number): string {
  const trim = (n: number) => String(Number(n.toFixed(2)))
  if (value >= 10_000_000) return `₹${trim(value / 10_000_000)} Cr`
  if (value >= 100_000) return `₹${trim(value / 100_000)} L`
  return `₹${value.toLocaleString('en-IN')}`
}
