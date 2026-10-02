// Rule-based property assistant. Every property fact comes from the public,
// RLS-protected Supabase queries in ./properties — nothing is hardcoded.
import {
  describeFilters,
  hasAny,
  parseMessage,
  type ChatFilters,
  type Locations,
  type ParsedMessage,
  type PropertyField,
} from '@/lib/chatParser'
import { formatCurrency, titleCase } from '@/lib/utils'
import type {
  PaginatedResult,
  PropertySearchItem,
  PropertyWithRelations,
} from '@/types/domain'
import {
  getPublicPropertyBySlug,
  listPublicLocations,
  searchPublicProperties,
} from './properties'
import { getPublicImageUrl } from './storage'

const RESULT_LIMIT = 6
const SALE_BUDGET_THRESHOLD = 1_000_000

export interface ChatEnquiryTarget {
  propertyId: string | null
  propertySlug: string | null
  propertyTitle: string | null
}

export interface ConversationState {
  filters: ChatFilters
  lastResults: PropertySearchItem[]
  /** Property currently being discussed (last single result or one asked about). */
  focusSlug: string | null
  awaiting: 'budget' | 'requirements' | null
}

export interface AssistantTurn {
  reply: string
  properties: PropertySearchItem[]
  enquiry: ChatEnquiryTarget | null
  suggestions: string[]
  noResults: boolean
  state: ConversationState
}

export const initialConversation = (): ConversationState => ({
  filters: {},
  lastResults: [],
  focusSlug: null,
  awaiting: null,
})

const NO_RESULTS =
  "I couldn't find a published property matching all of those requirements."

const HELP: Record<string, string> = {
  search:
    'Tell me what you need here, for example "2 BHK in Jaipur under 50 lakh", or open "Browse homes" in the menu to filter by keyword, city, home type and buy/rent.',
  contact:
    'Send an enquiry and a property advisor will get back to you. You can do it right here in the chat or from the "Arrange a viewing" form on any property page.',
  enquiry:
    'Open any property and fill in the "Arrange a viewing" form, or tap "Enquire" on a property card here in the chat. Add your name, email, an optional phone number and a short message.',
  rent: 'Ask me for "properties for rent" (add a city or budget if you like), or choose "For rent" in the filters on the Browse homes page.',
  details:
    'Tap "View details" on any property card to open its page with photos, the full description and an enquiry form.',
}

// Session caches keep repeated questions from re-querying the database.
let locationsPromise: Promise<Locations> | null = null
const searchCache = new Map<string, PaginatedResult<PropertySearchItem>>()
const detailCache = new Map<string, PropertyWithRelations>()

/** Clears the session caches (used by tests and after "start over"). */
export function clearAssistantCache() {
  locationsPromise = null
  searchCache.clear()
  detailCache.clear()
}

function loadLocations(): Promise<Locations> {
  locationsPromise ??= listPublicLocations().catch((error) => {
    locationsPromise = null
    throw error
  })
  return locationsPromise
}

async function search(filters: ChatFilters) {
  const key = JSON.stringify(filters)
  const cached = searchCache.get(key)
  if (cached) return cached
  const result = await searchPublicProperties({
    query: filters.query,
    city: filters.city,
    region: filters.region,
    propertyType: filters.propertyType,
    listingType: filters.listingType,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    bedrooms: filters.bedrooms,
    maxBedrooms: filters.bedrooms,
    bathrooms: filters.minBathrooms,
    minArea: filters.minArea,
    maxArea: filters.maxArea,
    featured: filters.featured,
    page: 1,
    pageSize: RESULT_LIMIT,
  })
  if (searchCache.size > 30) searchCache.clear()
  searchCache.set(key, result)
  return result
}

async function details(slug: string) {
  const cached = detailCache.get(slug)
  if (cached) return cached
  const property = await getPublicPropertyBySlug(slug)
  detailCache.set(slug, property)
  return property
}

function toCard(property: PropertyWithRelations): PropertySearchItem {
  const image =
    property.property_images.find((item) => item.is_primary) ??
    property.property_images[0]
  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    excerpt: property.excerpt,
    property_type: property.property_type,
    listing_type: property.listing_type,
    price: property.price,
    currency: property.currency,
    city: property.city,
    region: property.region,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking_spaces: property.parking_spaces,
    floor_area: property.floor_area,
    featured: property.featured,
    published_at: property.published_at,
    primary_image_path: image?.storage_path ?? null,
    primary_image_alt: image?.alt_text ?? null,
    image_url: getPublicImageUrl(image?.storage_path ?? null),
  }
}

function priceText(
  p: Pick<PropertyWithRelations, 'price' | 'currency' | 'listing_type'>,
) {
  return `${formatCurrency(p.price, p.currency)}${p.listing_type === 'rent' ? ' per month' : ''}`
}

function answerField(p: PropertyWithRelations, field: PropertyField): string {
  switch (field) {
    case 'price':
      return `It is listed at ${priceText(p)}.`
    case 'bedrooms':
      return `It has ${p.bedrooms} bedroom${p.bedrooms === 1 ? '' : 's'}.`
    case 'bathrooms':
      return `It has ${p.bathrooms} bathroom${p.bathrooms === 1 ? '' : 's'}.`
    case 'area': {
      const parts: string[] = []
      if (p.floor_area)
        parts.push(
          `a floor area of ${p.floor_area.toLocaleString('en-IN')} sq ft`,
        )
      if (p.lot_size)
        parts.push(`a lot size of ${p.lot_size.toLocaleString('en-IN')} sq ft`)
      return parts.length
        ? `It has ${parts.join(' and ')}.`
        : 'The size is not listed for this property.'
    }
    case 'location':
      return `It is at ${[
        p.address_line_1,
        p.address_line_2,
        p.city,
        p.region,
        p.postal_code,
      ]
        .filter(Boolean)
        .join(', ')}.`
    case 'listing':
      return `It is ${p.listing_type === 'rent' ? 'for rent' : 'for sale'}.`
    case 'availability':
      return `It is currently published and listed ${p.listing_type === 'rent' ? 'for rent' : 'for sale'}. For viewing dates or exact availability, please send an enquiry.`
    case 'amenities':
      return p.amenities.length
        ? `Listed amenities: ${p.amenities.join(', ')}.`
        : 'No amenities are listed for this property.'
    case 'parking':
      return p.parking_spaces
        ? `It has ${p.parking_spaces} parking space${p.parking_spaces === 1 ? '' : 's'}.`
        : 'No parking is listed for this property.'
    case 'year':
      return p.year_built
        ? `It was built in ${p.year_built}.`
        : 'The year built is not listed for this property.'
    case 'about': {
      const summary = p.excerpt || p.description
      const facts = `${titleCase(p.property_type)} ${p.listing_type === 'rent' ? 'for rent' : 'for sale'} in ${p.city}, ${p.region}: ${p.bedrooms} bed, ${p.bathrooms} bath${p.floor_area ? `, ${p.floor_area.toLocaleString('en-IN')} sq ft` : ''}, ${priceText(p)}.`
      return `${facts} ${summary.length > 320 ? `${summary.slice(0, 317).trimEnd()}…` : summary}`
    }
  }
}

function resolveSlug(
  parsed: ParsedMessage,
  state: ConversationState,
  pageSlug: string | null,
): string | null {
  if (parsed.ordinal !== null && state.lastResults.length) {
    const index =
      parsed.ordinal === -1 ? state.lastResults.length - 1 : parsed.ordinal
    return state.lastResults[index]?.slug ?? null
  }
  const named = state.lastResults.find((p) =>
    parsed.text.includes(p.title.toLowerCase()),
  )
  if (named) return named.slug
  if (parsed.thisProperty && pageSlug) return pageSlug
  return state.focusSlug ?? pageSlug
}

function refineSuggestions(filters: ChatFilters): string[] {
  const suggestions: string[] = []
  if (!filters.listingType) suggestions.push('Only rentals', 'Only for sale')
  if (filters.maxPrice === undefined) suggestions.push('Under 50 lakh')
  if (filters.bedrooms === undefined) suggestions.push('2 BHK only')
  suggestions.push('Contact an agent')
  return suggestions.slice(0, 4)
}

export function noResultSuggestions(filters: ChatFilters): string[] {
  const suggestions: string[] = []
  if (filters.maxPrice !== undefined) suggestions.push('Increase my budget')
  if (filters.city || filters.region || filters.query)
    suggestions.push('Search in any location')
  if (filters.propertyType) suggestions.push('Any property type')
  if (filters.bedrooms !== undefined) suggestions.push('Any number of bedrooms')
  if (filters.listingType) suggestions.push('Show both sale and rent')
  if (!suggestions.length) suggestions.push('Show all available properties')
  return suggestions
}

/**
 * A message that states two or more requirements on its own ("villa in Jaipur
 * under 1 crore") starts a new search; short follow-ups ("only rentals") refine
 * the previous one.
 */
function isFreshSearch(parsed: ParsedMessage): boolean {
  const f = parsed.filters
  const dimensions = [
    f.city ?? f.region ?? f.query,
    f.propertyType,
    f.listingType,
    f.minPrice ?? f.maxPrice,
    f.bedrooms,
    f.minBathrooms,
    f.minArea ?? f.maxArea,
  ].filter((value) => value !== undefined).length
  const refining =
    /\b(only|also|instead|but|now|what about|how about|just|sirf|bhi|same)\b/.test(
      parsed.text,
    )
  return dimensions >= 2 && !refining
}

const FALLBACK_SUGGESTIONS = [
  'Properties for sale',
  'Properties for rent',
  'Show 2 BHK properties',
  'Contact an agent',
]

export async function respond(
  message: string,
  state: ConversationState,
  context: { propertySlug: string | null },
): Promise<AssistantTurn> {
  const parsed = parseMessage(message, await loadLocations())
  const turn = (
    reply: string,
    extra: Partial<Omit<AssistantTurn, 'reply'>> = {},
  ): AssistantTurn => ({
    reply,
    properties: [],
    enquiry: null,
    suggestions: [],
    noResults: false,
    state: { ...state, awaiting: null },
    ...extra,
  })

  if (parsed.restricted)
    return turn(
      "Sorry, I can't share internal or private information such as customer, lead or agent contact details. I can help you find published properties or send an enquiry to our advisors.",
      { suggestions: ['Find a property', 'Contact an agent'] },
    )

  // An answer to "what's your budget?"
  if (state.awaiting === 'budget' && parsed.bareAmount !== null)
    parsed.filters.maxPrice ??= parsed.bareAmount

  const newFilters = hasAny(parsed.filters)
  const slug = resolveSlug(parsed, state, context.propertySlug)
  const pointsAtProperty =
    parsed.ordinal !== null ||
    parsed.thisProperty ||
    state.lastResults.some((p) => parsed.text.includes(p.title.toLowerCase()))

  if (parsed.enquire && !newFilters) {
    let target: ChatEnquiryTarget = {
      propertyId: null,
      propertySlug: null,
      propertyTitle: null,
    }
    const enquirySlug =
      pointsAtProperty || context.propertySlug
        ? slug
        : state.lastResults.length === 1
          ? state.lastResults[0]!.slug
          : null
    if (enquirySlug) {
      const property = await details(enquirySlug)
      target = {
        propertyId: property.id,
        propertySlug: property.slug,
        propertyTitle: property.title,
      }
    }
    return turn(
      target.propertyTitle
        ? `Happy to help. Share your details below and a property advisor will contact you about ${target.propertyTitle}.`
        : 'Happy to help. Share your details below and a property advisor will contact you.',
      {
        enquiry: target,
        state: {
          ...state,
          awaiting: null,
          focusSlug: target.propertySlug ?? state.focusSlug,
        },
      },
    )
  }

  if (parsed.help)
    return turn(HELP[parsed.help]!, {
      suggestions:
        parsed.help === 'contact' || parsed.help === 'enquiry'
          ? ['Contact an agent', 'Find a property']
          : ['Properties for sale', 'Properties for rent'],
    })

  if (parsed.askLocations) {
    const { cities, regions } = await loadLocations()
    if (!cities.length)
      return turn(
        'There are no published properties at the moment. Please check back soon.',
      )
    return turn(
      `We currently have published properties in ${cities.join(', ')}${regions.length ? ` (${regions.join(', ')})` : ''}.`,
      {
        suggestions: cities.slice(0, 4).map((city) => `Properties in ${city}`),
      },
    )
  }

  // Question about a specific property.
  // Searches ("show all available properties") win unless a property is named.
  const isSearchRequest =
    newFilters ||
    parsed.resetAll ||
    (parsed.wantsSearch && !parsed.thisProperty)
  if (parsed.fields.length && slug && (pointsAtProperty || !isSearchRequest)) {
    const property = await details(slug).catch(() => null)
    if (!property)
      return turn(
        'That property is no longer available on the website. Would you like me to search for similar ones?',
        { suggestions: ['Find a property'] },
      )
    const answer = parsed.fields
      .map((field) => answerField(property, field))
      .join(' ')
    return turn(`${property.title}: ${answer}`, {
      properties: parsed.fields.includes('about') ? [toCard(property)] : [],
      suggestions: [
        'I want to enquire about this property',
        'Find similar properties',
      ],
      state: { ...state, awaiting: null, focusSlug: property.slug },
    })
  }
  if (parsed.fields.length && !newFilters && !parsed.wantsSearch)
    return turn(
      'Which property do you mean? Open a property page or ask me to search first, then ask about "the first one", "the second one" and so on.',
      { suggestions: FALLBACK_SUGGESTIONS },
    )

  if (parsed.greeting && !newFilters)
    return turn(
      'Hello! Tell me what you are looking for, for example "2 BHK in Jaipur under 50 lakh" or "houses for rent".',
      { suggestions: FALLBACK_SUGGESTIONS },
    )
  if (parsed.thanks && !newFilters)
    return turn("You're welcome! Anything else I can help you find?", {
      suggestions: ['Find a property', 'Contact an agent'],
    })

  // "Find similar" reuses the focused property's type, listing and city.
  if (/\bsimilar\b/.test(parsed.text) && state.focusSlug) {
    const focus = await details(state.focusSlug).catch(() => null)
    if (focus)
      Object.assign(parsed.filters, {
        city: focus.city,
        propertyType: focus.property_type,
        listingType: focus.listing_type,
      })
  }

  const refining =
    newFilters ||
    parsed.cleared.length > 0 ||
    parsed.raiseBudget ||
    parsed.lowerBudget ||
    parsed.resetAll ||
    /\bsimilar\b/.test(parsed.text)
  if (!refining && !parsed.wantsSearch && !parsed.wantsBudgetSearch)
    return turn(
      'Sorry, I\'m not sure I understood that. I can search published properties (e.g. "2 BHK in Jaipur under 50 lakh"), answer questions about a listing, or connect you with an advisor. For anything else, please send an enquiry.',
      { suggestions: FALLBACK_SUGGESTIONS },
    )

  let filters: ChatFilters =
    parsed.resetAll || isFreshSearch(parsed) ? {} : { ...state.filters }
  for (const key of parsed.cleared) delete filters[key]
  // A new city replaces an earlier region and vice versa.
  if (parsed.filters.city || parsed.filters.region) {
    delete filters.city
    delete filters.region
  }
  filters = { ...filters, ...parsed.filters }
  // Rents are monthly, so a budget in lakhs/crores means buying.
  const budget = parsed.filters.maxPrice ?? parsed.filters.minPrice
  if (
    budget !== undefined &&
    budget >= SALE_BUDGET_THRESHOLD &&
    !filters.listingType &&
    !parsed.cleared.includes('listingType')
  )
    filters.listingType = 'sale'
  if (parsed.raiseBudget && filters.maxPrice !== undefined)
    filters.maxPrice = Math.round(filters.maxPrice * 1.5)
  if (parsed.lowerBudget) {
    const reference =
      filters.maxPrice ?? Math.max(0, ...state.lastResults.map((p) => p.price))
    if (reference > 0) filters.maxPrice = Math.round(reference * 0.8)
  }

  if (parsed.wantsBudgetSearch && filters.maxPrice === undefined)
    return turn(
      'Sure. What is your budget? For example "under 50 lakh" or "between 30 and 60 lakh".',
      {
        suggestions: ['Under 25 lakh', 'Under 50 lakh', 'Under 1 crore'],
        state: { ...state, filters, awaiting: 'budget' },
      },
    )

  if (!hasAny(filters) && !parsed.resetAll && state.awaiting !== 'requirements')
    return turn(
      'Sure! Which city are you looking in, what is your budget, and do you want to buy or rent? You can also pick an option below.',
      {
        suggestions: [
          'Properties for sale',
          'Properties for rent',
          'Show 2 BHK properties',
          'Show all available properties',
        ],
        state: { ...state, filters, awaiting: 'requirements' },
      },
    )

  const result = await search(filters)
  const nextState: ConversationState = {
    filters,
    lastResults: result.data,
    focusSlug: result.data.length === 1 ? result.data[0]!.slug : null,
    awaiting: null,
  }

  if (!result.data.length)
    return turn(
      `${NO_RESULTS} Try changing the budget, location, property type, number of bedrooms, or sale/rent.`,
      {
        noResults: true,
        suggestions: noResultSuggestions(filters),
        state: nextState,
      },
    )

  const described = describeFilters(filters)
  let reply =
    result.total === 1
      ? `I found 1 published match for ${described}.`
      : `I found ${result.total} published ${described}.`
  if (result.total > result.data.length)
    reply += ` Here are the first ${result.data.length}.`
  if (filters.maxPrice === undefined && filters.minPrice === undefined)
    reply += ' Tell me your budget to narrow it down.'
  else if (filters.city === undefined && filters.region === undefined)
    reply += ' Tell me a city to narrow it down.'

  return turn(reply, {
    properties: result.data,
    suggestions: refineSuggestions(filters),
    state: nextState,
  })
}
