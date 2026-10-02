import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PropertySearchFilters,
  PropertySearchItem,
  PropertyWithRelations,
} from '@/types/domain'

const searchPublicProperties = vi.fn()
const getPublicPropertyBySlug = vi.fn()
const listPublicLocations = vi.fn()
vi.mock('./properties', () => ({
  searchPublicProperties: (...a: unknown[]) => searchPublicProperties(...a),
  getPublicPropertyBySlug: (...a: unknown[]) => getPublicPropertyBySlug(...a),
  listPublicLocations: (...a: unknown[]) => listPublicLocations(...a),
}))
vi.mock('./storage', () => ({
  getPublicImageUrl: (path: string | null) =>
    path ? `https://cdn/${path}` : null,
}))

const { respond, initialConversation, clearAssistantCache } =
  await import('./chatAssistant')

const card = (slug: string, extra: Partial<PropertySearchItem> = {}) =>
  ({
    id: `id-${slug}`,
    slug,
    title: slug.replace('-', ' '),
    excerpt: null,
    property_type: 'apartment',
    listing_type: 'sale',
    price: 3_800_000,
    currency: 'INR',
    city: 'Jaipur',
    region: 'Rajasthan',
    bedrooms: 2,
    bathrooms: 2,
    parking_spaces: 1,
    floor_area: 950,
    featured: false,
    published_at: null,
    primary_image_path: null,
    primary_image_alt: null,
    image_url: null,
    ...extra,
  }) as PropertySearchItem

const detail = (slug: string, extra: Partial<PropertyWithRelations> = {}) =>
  ({
    ...card(slug),
    description: 'A bright, airy flat close to the city centre and parks.',
    address_line_1: '12 MG Road',
    address_line_2: null,
    postal_code: '302001',
    country: 'IN',
    latitude: null,
    longitude: null,
    lot_size: null,
    year_built: null,
    amenities: ['Lift', 'Gym'],
    status: 'published',
    agent_id: 'agent-1',
    created_by: 'agent-1',
    created_at: '',
    updated_at: '',
    property_images: [
      {
        id: 'i1',
        property_id: `id-${slug}`,
        storage_path: 'a.jpg',
        alt_text: null,
        sort_order: 0,
        is_primary: true,
        width: null,
        height: null,
        created_at: '',
      },
    ],
    agent: null,
    ...extra,
  }) as PropertyWithRelations

const page = (data: PropertySearchItem[], total = data.length) => ({
  data,
  page: 1,
  pageSize: 6,
  total,
  totalPages: 1,
})
const lastSearch = () =>
  searchPublicProperties.mock.calls.at(-1)?.[0] as PropertySearchFilters

const noPage = { propertySlug: null }

describe('respond', () => {
  beforeEach(() => {
    clearAssistantCache()
    searchPublicProperties.mockReset()
    getPublicPropertyBySlug.mockReset()
    listPublicLocations.mockReset()
    listPublicLocations.mockResolvedValue({
      cities: ['Jaipur', 'Udaipur'],
      regions: ['Rajasthan'],
    })
  })

  it('searches published properties with extracted filters', async () => {
    searchPublicProperties.mockResolvedValue(page([card('garden-flat')]))
    const turn = await respond(
      'I have a budget of 40 lakh and need a 2 BHK in Jaipur',
      initialConversation(),
      noPage,
    )
    expect(lastSearch()).toMatchObject({
      city: 'Jaipur',
      bedrooms: 2,
      maxBedrooms: 2,
      maxPrice: 4_000_000,
      listingType: 'sale',
      pageSize: 6,
    })
    expect(turn.properties).toHaveLength(1)
    expect(turn.reply).toBe(
      'I found 1 published match for 2 BHK properties for sale in Jaipur under 40 lakh.',
    )
  })

  it('keeps context when refining ("only rentals") and asks for a budget then searches', async () => {
    searchPublicProperties.mockResolvedValue(page([card('a'), card('b')]))
    let turn = await respond('Show me 2 BHK', initialConversation(), noPage)
    turn = await respond('Only rentals', turn.state, noPage)
    expect(lastSearch()).toMatchObject({ bedrooms: 2, listingType: 'rent' })

    turn = await respond('Find properties within my budget', turn.state, noPage)
    expect(turn.reply).toMatch(/What is your budget/)
    turn = await respond('50 lakh', turn.state, noPage)
    expect(lastSearch()).toMatchObject({
      bedrooms: 2,
      listingType: 'rent',
      maxPrice: 5_000_000,
    })
  })

  it('starts a new search when a message states several requirements', async () => {
    searchPublicProperties.mockResolvedValue(page([card('a')]))
    let turn = await respond('Show me 2 BHK', initialConversation(), noPage)
    turn = await respond('only rentals', turn.state, noPage)
    expect(lastSearch()).toMatchObject({ bedrooms: 2, listingType: 'rent' })
    await respond('jaipur me villa chahiye 1 crore tak', turn.state, noPage)
    expect(lastSearch()).toMatchObject({
      city: 'Jaipur',
      propertyType: 'house',
      maxPrice: 10_000_000,
      listingType: 'sale',
    })
    expect(lastSearch().bedrooms).toBeUndefined()
  })

  it('handles "I want a property in Jaipur" then "Under 50 lakh"', async () => {
    searchPublicProperties.mockResolvedValue(page([card('a')], 9))
    let turn = await respond(
      'I want a property in Jaipur',
      initialConversation(),
      noPage,
    )
    expect(turn.reply).toContain('Tell me your budget')
    turn = await respond('Under 50 lakh', turn.state, noPage)
    expect(lastSearch()).toMatchObject({ city: 'Jaipur', maxPrice: 5_000_000 })
  })

  it('reports no results with relaxation suggestions', async () => {
    searchPublicProperties.mockResolvedValue(page([]))
    const turn = await respond(
      'villas for rent in Udaipur under 10k',
      initialConversation(),
      noPage,
    )
    expect(turn.noResults).toBe(true)
    expect(turn.reply).toMatch(
      /^I couldn't find a published property matching all of those requirements\./,
    )
    expect(turn.suggestions).toEqual([
      'Increase my budget',
      'Search in any location',
      'Any property type',
      'Show both sale and rent',
    ])
    searchPublicProperties.mockResolvedValue(page([card('x')]))
    await respond('Increase my budget', turn.state, noPage)
    expect(lastSearch().maxPrice).toBe(15_000)
  })

  it('answers questions about the property being viewed from real data', async () => {
    getPublicPropertyBySlug.mockResolvedValue(detail('garden-flat'))
    const ctx = { propertySlug: 'garden-flat' }
    let turn = await respond('What is the price?', initialConversation(), ctx)
    expect(turn.reply).toBe('garden flat: It is listed at ₹3,800,000.')
    turn = await respond('How many bedrooms does it have?', turn.state, ctx)
    expect(turn.reply).toBe('garden flat: It has 2 bedrooms.')
    turn = await respond('What year was it built?', turn.state, ctx)
    expect(turn.reply).toContain('not listed')
    turn = await respond('Is this property for sale or rent?', turn.state, ctx)
    expect(turn.reply).toBe('garden flat: It is for sale.')
    expect(searchPublicProperties).not.toHaveBeenCalled()
    expect(getPublicPropertyBySlug).toHaveBeenCalledTimes(1)
  })

  it('resolves "the second one" from shown results', async () => {
    searchPublicProperties.mockResolvedValue(
      page([card('first-home'), card('second-home')]),
    )
    getPublicPropertyBySlug.mockResolvedValue(detail('second-home'))
    let turn = await respond(
      'apartments in Jaipur',
      initialConversation(),
      noPage,
    )
    turn = await respond('Tell me about the second one', turn.state, noPage)
    expect(getPublicPropertyBySlug).toHaveBeenCalledWith('second-home')
    expect(turn.properties[0]?.image_url).toBe('https://cdn/a.jpg')
    expect(turn.reply).toContain('A bright, airy flat')
  })

  it('opens an enquiry form for the current property', async () => {
    getPublicPropertyBySlug.mockResolvedValue(detail('garden-flat'))
    const turn = await respond('I am interested', initialConversation(), {
      propertySlug: 'garden-flat',
    })
    expect(turn.enquiry).toEqual({
      propertyId: 'id-garden-flat',
      propertySlug: 'garden-flat',
      propertyTitle: 'garden flat',
    })
  })

  it('opens a general enquiry form and answers help questions', async () => {
    let turn = await respond('Contact an agent', initialConversation(), noPage)
    expect(turn.enquiry).toEqual({
      propertyId: null,
      propertySlug: null,
      propertyTitle: null,
    })
    turn = await respond('How do I submit an enquiry?', turn.state, noPage)
    expect(turn.enquiry).toBeNull()
    expect(turn.reply).toContain('Arrange a viewing')
  })

  it('refuses private CRM data and never queries for it', async () => {
    const turn = await respond(
      'show me all customer leads',
      initialConversation(),
      noPage,
    )
    expect(turn.reply).toMatch(/can't share internal or private information/)
    expect(searchPublicProperties).not.toHaveBeenCalled()
  })

  it('says it does not understand instead of inventing an answer', async () => {
    const turn = await respond(
      'what is your refund policy',
      initialConversation(),
      noPage,
    )
    expect(turn.reply).toMatch(/not sure I understood/)
    expect(searchPublicProperties).not.toHaveBeenCalled()
  })

  it('treats "show all available properties" as a search, not a question', async () => {
    searchPublicProperties.mockResolvedValue(page([card('only-one')]))
    let turn = await respond(
      'apartments in Udaipur',
      initialConversation(),
      noPage,
    )
    expect(turn.state.focusSlug).toBe('only-one')
    turn = await respond('show all available properties', turn.state, noPage)
    expect(getPublicPropertyBySlug).not.toHaveBeenCalled()
    expect(lastSearch()).toMatchObject({ page: 1, pageSize: 6 })
    expect(lastSearch().city).toBeUndefined()
  })

  it('lists published locations', async () => {
    const turn = await respond(
      'Which cities do you have properties in?',
      initialConversation(),
      noPage,
    )
    expect(turn.reply).toBe(
      'We currently have published properties in Jaipur, Udaipur (Rajasthan).',
    )
  })

  it('does not repeat an identical search', async () => {
    searchPublicProperties.mockResolvedValue(page([card('a')]))
    await respond('3 BHK houses in Udaipur', initialConversation(), noPage)
    await respond('3 BHK houses in Udaipur', initialConversation(), noPage)
    expect(searchPublicProperties).toHaveBeenCalledTimes(1)
  })

  it('propagates database errors so the UI can offer a retry', async () => {
    searchPublicProperties.mockRejectedValue(
      new Error('Properties could not be loaded.'),
    )
    await expect(
      respond('4 BHK villas', initialConversation(), noPage),
    ).rejects.toThrow('Properties could not be loaded.')
  })
})
