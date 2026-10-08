import { describe, expect, it } from 'vitest'
import type { Customer, Lead, Notification } from '@/types/domain'
import {
  copySlug,
  customerSearchFilters,
  followUpBucket,
  formatINRShort,
  fromDateTimeLocal,
  groupLeadsByStatus,
  hasMatchCriteria,
  notificationLink,
  parseAmenities,
  toDateTimeLocal,
} from './crm'

const customer = (extra: Partial<Customer> = {}): Customer => ({
  id: 'c1',
  full_name: 'Asha Rao',
  email: null,
  phone: null,
  alternate_phone: null,
  source: 'phone',
  customer_type: 'buyer',
  customer_status: 'new',
  preferred_location: null,
  preferred_property_type: null,
  preferred_listing_type: null,
  budget_min: null,
  budget_max: null,
  bedrooms_required: null,
  notes: null,
  assigned_agent_id: null,
  created_by: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...extra,
})

describe('followUpBucket', () => {
  const now = new Date(2026, 9, 8, 12, 0)
  it('marks past pending follow-ups as overdue', () => {
    expect(
      followUpBucket(new Date(2026, 9, 8, 9, 0).toISOString(), 'pending', now),
    ).toBe('overdue')
  })
  it('separates later today from upcoming days', () => {
    expect(
      followUpBucket(new Date(2026, 9, 8, 17, 0).toISOString(), 'pending', now),
    ).toBe('today')
    expect(
      followUpBucket(new Date(2026, 9, 9, 9, 0).toISOString(), 'pending', now),
    ).toBe('upcoming')
  })
  it('treats anything not pending as closed', () => {
    expect(
      followUpBucket(new Date(2026, 9, 1).toISOString(), 'completed', now),
    ).toBe('closed')
  })
})

describe('customer matching', () => {
  it('needs at least one preference', () => {
    expect(hasMatchCriteria(customer())).toBe(false)
    expect(hasMatchCriteria(customer({ budget_max: 5_000_000 }))).toBe(true)
    expect(hasMatchCriteria(customer({ bedrooms_required: 0 }))).toBe(true)
  })
  it('turns preferences into published-listing filters', () => {
    expect(
      customerSearchFilters(
        customer({
          preferred_location: 'Jaipur, Rajasthan',
          preferred_property_type: 'apartment',
          preferred_listing_type: 'sale',
          budget_min: 3_000_000,
          budget_max: 6_000_000,
          bedrooms_required: 2,
        }),
      ),
    ).toEqual({
      query: 'Jaipur',
      propertyType: 'apartment',
      listingType: 'sale',
      minPrice: 3_000_000,
      maxPrice: 6_000_000,
      bedrooms: 2,
      page: 1,
      pageSize: 6,
    })
  })
})

describe('parseAmenities', () => {
  it('splits, trims and removes case-insensitive duplicates', () => {
    expect(parseAmenities(' Lift, gym\nGym ,,  Power   backup ')).toEqual([
      'Lift',
      'gym',
      'Power backup',
    ])
  })
})

describe('copySlug', () => {
  it('does not stack copy suffixes', () => {
    expect(copySlug('sea-view-flat', 'a1')).toBe('sea-view-flat-copy-a1')
    expect(copySlug('sea-view-flat-copy-a1', 'b2')).toBe(
      'sea-view-flat-copy-b2',
    )
  })
})

describe('groupLeadsByStatus', () => {
  it('returns every stage, empty or not', () => {
    const lead = { id: 'l1', status: 'qualified' } as Lead
    const groups = groupLeadsByStatus([lead])
    expect(groups.qualified).toEqual([lead])
    expect(groups.new).toEqual([])
    expect(Object.keys(groups)).toHaveLength(8)
  })
})

describe('datetime-local helpers', () => {
  it('round-trips through the input format', () => {
    const iso = new Date(2026, 9, 8, 15, 30).toISOString()
    expect(toDateTimeLocal(iso)).toBe('2026-10-08T15:30')
    expect(fromDateTimeLocal('2026-10-08T15:30')).toBe(iso)
  })
  it('handles empty values', () => {
    expect(toDateTimeLocal(null)).toBe('')
    expect(fromDateTimeLocal('')).toBeNull()
  })
})

describe('notificationLink', () => {
  const note = (entity_type: string | null, entity_id: string | null) =>
    ({ entity_type, entity_id }) as Notification
  it('links to the record a notification is about', () => {
    expect(notificationLink(note('lead', 'l1'))).toBe('/crm/leads/l1')
    expect(notificationLink(note('customer', 'c1'))).toBe('/crm/customers/c1')
    expect(notificationLink(note('profile', 'p1'))).toBe('/crm/agents')
    expect(notificationLink(note('lead', null))).toBeNull()
  })
})

describe('formatINRShort', () => {
  it('uses lakh and crore', () => {
    expect(formatINRShort(4_500_000)).toBe('₹45 L')
    expect(formatINRShort(20_000_000)).toBe('₹2 Cr')
    expect(formatINRShort(12_500_000)).toBe('₹1.25 Cr')
    expect(formatINRShort(60_000)).toBe('₹60,000')
  })
})
