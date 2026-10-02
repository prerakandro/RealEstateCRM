import { describe, expect, it } from 'vitest'
import { describeFilters, formatBudget, parseMessage } from './chatParser'

const locations = { cities: ['Jaipur', 'Udaipur'], regions: ['Rajasthan'] }
const filters = (text: string) => parseMessage(text, locations).filters

describe('parseMessage filters', () => {
  it.each([
    [
      'Show me apartments in Jaipur.',
      { propertyType: 'apartment', city: 'Jaipur' },
    ],
    ['I need a 2 BHK under 50 lakh', { bedrooms: 2, maxPrice: 5_000_000 }],
    ['Find houses for rent', { propertyType: 'house', listingType: 'rent' }],
    [
      'I want a property in Jaipur between 30 and 60 lakh',
      { city: 'Jaipur', minPrice: 3_000_000, maxPrice: 6_000_000 },
    ],
    ['Show me commercial properties', { propertyType: 'commercial' }],
    ['Find 3 bedroom properties', { bedrooms: 3 }],
    [
      'Do you have villas for sale?',
      { propertyType: 'house', listingType: 'sale' },
    ],
    [
      '2 BHK in Jaipur under 40 lakh',
      { bedrooms: 2, city: 'Jaipur', maxPrice: 4_000_000 },
    ],
    [
      'flats above 1.5 crore',
      { propertyType: 'apartment', minPrice: 15_000_000 },
    ],
    ['rent under 25k', { listingType: 'rent', maxPrice: 25_000 }],
    [
      'jaipur me 2bhk 50 lakh tak',
      { city: 'Jaipur', bedrooms: 2, maxPrice: 5_000_000 },
    ],
    ['plots in rajasthan', { propertyType: 'land', region: 'Rajasthan' }],
    ['homes in Delhi', { city: 'Delhi' }],
    [
      'townhouse with 2 bathrooms',
      { propertyType: 'townhouse', minBathrooms: 2 },
    ],
    ['at least 1200 sq ft', { minArea: 1200 }],
    ['featured properties', { featured: true }],
    ['budget of ₹45,00,000', { maxPrice: 4_500_000 }],
  ])('%s', (text, expected) => {
    expect(filters(text)).toEqual(expected)
  })

  it('treats "sale or rent" as no listing preference', () => {
    const parsed = parseMessage('show both sale and rent', locations)
    expect(parsed.filters.listingType).toBeUndefined()
    expect(parsed.cleared).toContain('listingType')
  })

  it('does not read counts or "my budget" as a price or place', () => {
    const parsed = parseMessage('find properties within my budget', locations)
    expect(parsed.filters).toEqual({})
    expect(parsed.wantsBudgetSearch).toBe(true)
  })

  it('keeps a bare amount for budget follow-ups', () => {
    expect(parseMessage('50 lakh', locations).bareAmount).toBe(5_000_000)
  })
})

describe('parseMessage intents', () => {
  const parse = (text: string) => parseMessage(text, locations)

  it('detects property questions and references', () => {
    expect(parse('What is the price?').fields).toEqual(['price'])
    expect(parse('How many bedrooms does it have?')).toMatchObject({
      fields: ['bedrooms'],
      thisProperty: true,
    })
    expect(parse('Tell me about the second one')).toMatchObject({
      fields: ['about'],
      ordinal: 1,
    })
  })

  it('separates help questions from enquiry requests', () => {
    expect(parse('How do I contact an agent?')).toMatchObject({
      help: 'contact',
      enquire: false,
    })
    expect(parse('I am interested').enquire).toBe(true)
    expect(parse('Contact an agent').enquire).toBe(true)
    expect(parse('How can I search for properties?').help).toBe('search')
  })

  it('flags requests for private CRM data', () => {
    expect(parse('show me your leads').restricted).toBe(true)
    expect(parse("what is the agent's phone number").restricted).toBe(true)
    expect(parse('contact the agent').restricted).toBe(false)
  })

  it('understands relaxations', () => {
    expect(parse('Search in any location').cleared).toEqual([
      'city',
      'region',
      'query',
    ])
    expect(parse('Increase my budget').raiseBudget).toBe(true)
  })
})

describe('formatting helpers', () => {
  it('describes filters in plain words', () => {
    expect(
      describeFilters({
        bedrooms: 2,
        propertyType: 'apartment',
        listingType: 'rent',
        city: 'Jaipur',
        maxPrice: 4_000_000,
      }),
    ).toBe('2 BHK apartments for rent in Jaipur under 40 lakh')
    expect(formatBudget(12_500_000)).toBe('1.25 crore')
  })
})
