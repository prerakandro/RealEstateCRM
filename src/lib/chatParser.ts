// Rule-based understanding of chatbot messages. No external AI service:
// requirements are extracted with patterns and then searched in Supabase.
import type { ListingType, PropertyType } from '@/types/domain'

export interface ChatFilters {
  query?: string
  city?: string
  region?: string
  propertyType?: PropertyType
  listingType?: ListingType
  minPrice?: number
  maxPrice?: number
  /** Exact bedroom count ("2 BHK"). */
  bedrooms?: number
  minBathrooms?: number
  minArea?: number
  maxArea?: number
  featured?: boolean
}

export type PropertyField =
  | 'price'
  | 'bedrooms'
  | 'bathrooms'
  | 'area'
  | 'location'
  | 'listing'
  | 'availability'
  | 'amenities'
  | 'parking'
  | 'year'
  | 'about'

export type HelpTopic = 'search' | 'contact' | 'enquiry' | 'rent' | 'details'

export interface Locations {
  cities: string[]
  regions: string[]
}

export interface ParsedMessage {
  text: string
  filters: ChatFilters
  /** Filters the visitor explicitly asked to drop ("any location"). */
  cleared: Array<keyof ChatFilters>
  resetAll: boolean
  raiseBudget: boolean
  lowerBudget: boolean
  greeting: boolean
  thanks: boolean
  restricted: boolean
  enquire: boolean
  help: HelpTopic | null
  askLocations: boolean
  wantsBudgetSearch: boolean
  wantsSearch: boolean
  fields: PropertyField[]
  /** 0-based index into the last shown results ("the second one"); -1 = last. */
  ordinal: number | null
  /** Refers to "this property" / "it". */
  thisProperty: boolean
  /** A lone amount with no qualifier, e.g. a reply to "what's your budget?" */
  bareAmount: number | null
}

const UNIT: Record<string, number> = {
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  l: 1e5,
  k: 1e3,
  thousand: 1e3,
  million: 1e6,
  mn: 1e6,
  m: 1e6,
}

const AMOUNT = String.raw`(?:₹|rs\.?|inr|\$|usd)?\s*(\d[\d,]*(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|l|k|thousand|million|mn|m)?\b`
const MAX_BEFORE =
  /(under|below|less than|upto|up to|within|max(?:imum)?|not more than|budget(?: of| is)?|no more than|<)\s*$/
const MIN_BEFORE =
  /(above|over|more than|at least|min(?:imum)?|starting(?: at| from)?|from|>)\s*$/
const MAX_AFTER = /^\s*(tak|se kam|or less|max(?:imum)?|and below|or below)\b/
const MIN_AFTER =
  /^\s*(se upar|se zyada|se jyada|or more|plus|\+|and above|or above|minimum)/

function toAmount(digits: string, unit?: string): number | null {
  const value = Number(digits.replaceAll(',', ''))
  if (!Number.isFinite(value)) return null
  const multiplier = unit ? (UNIT[unit] ?? 1) : 1
  const amount = Math.round(value * multiplier)
  // Plain numbers below 1000 are counts, not prices.
  if (!unit && amount < 1000) return null
  return amount
}

function parsePrice(text: string): {
  min?: number
  max?: number
  bare: number | null
} {
  const range = new RegExp(
    String.raw`(?:between|from)?\s*${AMOUNT}\s*(?:and|to|-|–)\s*${AMOUNT}`,
  ).exec(text)
  if (range) {
    const [, d1, u1, d2, u2] = range
    // "30 to 60 lakh": the second unit applies to both.
    const low = toAmount(d1!, u1 ?? u2)
    const high = toAmount(d2!, u2 ?? u1)
    if (low !== null && high !== null)
      return { min: Math.min(low, high), max: Math.max(low, high), bare: null }
  }

  const result: { min?: number; max?: number; bare: number | null } = {
    bare: null,
  }
  for (const match of text.matchAll(new RegExp(AMOUNT, 'g'))) {
    const amount = toAmount(match[1]!, match[2])
    if (amount === null) continue
    const before = text.slice(Math.max(0, match.index - 30), match.index)
    const after = text.slice(match.index + match[0].length)
    if (MIN_BEFORE.test(before) || MIN_AFTER.test(after)) result.min = amount
    else if (MAX_BEFORE.test(before) || MAX_AFTER.test(after))
      result.max = amount
    else result.bare = amount
  }
  return result
}

const PROPERTY_TYPE_PATTERNS: Array<[PropertyType, RegExp]> = [
  ['townhouse', /\b(town ?houses?|row ?houses?)\b/],
  ['apartment', /\b(apartments?|flats?|condos?|studios?)\b/],
  [
    'house',
    /\b(houses?|villas?|bungalows?|kothi|independent (?:house|home))\b/,
  ],
  ['land', /\b(land|plots?)\b/],
  ['commercial', /\b(commercial|offices?|shops?|showrooms?|retail)\b/],
]

const STOP_WORDS = new Set([
  'my',
  'the',
  'a',
  'an',
  'this',
  'that',
  'any',
  'budget',
  'rent',
  'sale',
  'range',
  'total',
  'it',
  'mind',
  'future',
  'detail',
  'details',
])

function findLocation(
  text: string,
  locations: Locations,
): Pick<ChatFilters, 'city' | 'region'> {
  const byLength = (a: string, b: string) => b.length - a.length
  for (const city of [...locations.cities].sort(byLength))
    if (new RegExp(String.raw`\b${escape(city.toLowerCase())}\b`).test(text))
      return { city }
  for (const region of [...locations.regions].sort(byLength))
    if (new RegExp(String.raw`\b${escape(region.toLowerCase())}\b`).test(text))
      return { region }

  // Unknown place: "in Delhi", "near Pune" — still searched so the visitor
  // gets an honest "nothing found" instead of results from elsewhere.
  const match =
    /\b(?:in|at|near|around)\s+([a-z][a-z .'-]{1,40}?)(?=\s+(?:under|below|above|over|for|with|between|within|budget|upto|up|from|and|or|me|mein|having)\b|[,.?!]|$)/.exec(
      text,
    )
  const place = match?.[1]?.trim()
  if (!place || STOP_WORDS.has(place.split(' ')[0]!)) return {}
  if (/\d|bhk|bed|bath|sq|lakh|crore/.test(place)) return {}
  return { city: place.replace(/\b\w/g, (c) => c.toUpperCase()) }
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const FIELD_PATTERNS: Array<[PropertyField, RegExp]> = [
  ['price', /\b(price|cost|rate|how much|kitna|kitne ka|kya rate|expensive)\b/],
  ['bedrooms', /\b(bed ?rooms?|beds|bhk|kamre)\b/],
  ['bathrooms', /\b(bath ?rooms?|baths|toilets?|washrooms?)\b/],
  ['area', /\b(area|size|sq\.? ?ft|square feet|carpet|how big|lot size)\b/],
  ['location', /\b(where|location|located|address|kahan|kaha)\b/],
  [
    'listing',
    /\b(sale or rent|rent or sale|for sale|for rent|on rent|buy or rent)\b/,
  ],
  [
    'availability',
    /\b(availability|still (?:available|listed)|(?:is|are) (?:it|this|they) available|sold out|already sold)\b/,
  ],
  ['amenities', /\b(amenit(?:y|ies)|features?|facilities|facility)\b/],
  ['parking', /\b(parking|garage|car space)\b/],
  [
    'year',
    /\b(year (?:was (?:it|this) )?built|built in|when was (?:it|this) built|what year|how old|age of|construction year)\b/,
  ],
  [
    'about',
    /\b(tell me (?:more )?about|describe|details?|more info(?:rmation)?|what is it like|batao)\b/,
  ],
]

const ORDINALS: Record<string, number> = {
  first: 0,
  '1st': 0,
  second: 1,
  '2nd': 1,
  third: 2,
  '3rd': 2,
  fourth: 3,
  '4th': 3,
  fifth: 4,
  '5th': 4,
  sixth: 5,
  '6th': 5,
  last: -1,
}

export function parseMessage(raw: string, locations: Locations): ParsedMessage {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  const filters: ChatFilters = {}
  let rest = text

  const bhk =
    /(\d+)\s*(?:bhk|b\.h\.k|bed(?:room)?s?|br|rk)\b/.exec(rest) ??
    /\b(one|two|three|four|five)\s*(?:bhk|bed(?:room)?s?)\b/.exec(rest)
  if (bhk) {
    const words: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
    }
    filters.bedrooms = words[bhk[1]!] ?? Number(bhk[1])
    rest = rest.replace(bhk[0], ' ')
  }

  const bath = /(\d+)\s*(?:bath(?:room)?s?|toilets?|washrooms?)\b/.exec(rest)
  if (bath) {
    filters.minBathrooms = Number(bath[1])
    rest = rest.replace(bath[0], ' ')
  }

  const area =
    /(under|below|less than|upto|up to|max(?:imum)?|above|over|more than|at least|min(?:imum)?)?\s*(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square feet|sq feet|sft)\b/.exec(
      rest,
    )
  if (area) {
    const value = Number(area[2]!.replaceAll(',', ''))
    if (/under|below|less|upto|up to|max/.test(area[1] ?? ''))
      filters.maxArea = value
    else filters.minArea = value
    rest = rest.replace(area[0], ' ')
  }

  const price = parsePrice(rest)
  if (price.min !== undefined) filters.minPrice = price.min
  if (price.max !== undefined) filters.maxPrice = price.max

  for (const [type, pattern] of PROPERTY_TYPE_PATTERNS)
    if (pattern.test(text)) {
      filters.propertyType = type
      break
    }

  const bothListings =
    /\b(both|sale and rent|rent and sale|sale or rent|rent or sale|buy or rent)\b/.test(
      text,
    )
  const rent =
    /\b(rent|rental|rentals|renting|lease|to let|tenant|kiraye?|kiraya)\b/.test(
      text,
    )
  const sale =
    /\b(buy|buying|sale|sell|purchase|for sale|kharid(?:na|ne)?|own)\b/.test(
      text,
    )
  if (!bothListings && rent !== sale)
    filters.listingType = rent ? 'rent' : 'sale'

  if (/\bfeatured\b/.test(text)) filters.featured = true

  Object.assign(filters, findLocation(text, locations))

  const cleared: Array<keyof ChatFilters> = []
  if (
    /\b(any|all) (locations?|city|cities|areas?|places?)\b|\banywhere\b/.test(
      text,
    )
  )
    cleared.push('city', 'region', 'query')
  if (/\bany (property )?types?\b/.test(text)) cleared.push('propertyType')
  if (/\bany (number of )?(bed ?rooms?|beds|bhk)\b/.test(text))
    cleared.push('bedrooms')
  if (bothListings) cleared.push('listingType')
  if (/\bany (budget|price)\b|\bno budget\b/.test(text))
    cleared.push('minPrice', 'maxPrice')

  const ordinalMatch =
    /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|last)\b(?! (?:time|step))/.exec(
      text,
    ) ?? /(?:#|number |no\.? ?)([1-6])\b/.exec(text)
  const ordinal = ordinalMatch
    ? (ORDINALS[ordinalMatch[1]!] ?? Number(ordinalMatch[1]) - 1)
    : null

  const fields = FIELD_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(
    ([field]) => field,
  )

  const isQuestion =
    /^(how|what|where|can i|could i|do i|is there|kaise)\b/.test(text)
  let help: HelpTopic | null = null
  if (isQuestion) {
    if (
      /\b(contact|reach|talk|speak|call)\b.*\b(agent|advisor|you|someone)\b/.test(
        text,
      )
    )
      help = 'contact'
    else if (/\b(submit|send|make)\b.*\b(enquiry|inquiry)\b/.test(text))
      help = 'enquiry'
    else if (/\b(view|see|open)\b.*\bdetails?\b/.test(text)) help = 'details'
    else if (/\b(find|search|look)\b.*\b(rent|rental)/.test(text)) help = 'rent'
    else if (/\b(search|find|browse|look for)\b/.test(text) && !hasAny(filters))
      help = 'search'
  }

  return {
    text,
    filters,
    cleared,
    resetAll:
      /^(start over|reset|new search|clear)\b/.test(text) ||
      /\b(show|see|list) (me )?all (the )?(available )?(properties|homes|listings)\b/.test(
        text,
      ),
    raiseBudget:
      /\b(increase|raise|higher|more|bigger|extend)\b.*\bbudget\b/.test(text),
    lowerBudget:
      /\b(cheaper|lower (?:price|budget)|less expensive|sasta)\b/.test(text),
    greeting:
      /^(hi|hello|hey|hii+|namaste|namaskar|good (morning|afternoon|evening))\b/.test(
        text,
      ),
    thanks: /\b(thanks|thank you|thx|dhanyavad|shukriya)\b/.test(text),
    restricted:
      /\b(leads?|customers?|admin|password|api key|database|supabase|follow[- ]?ups?|site visits?|notifications?|internal notes?|crm|credentials?)\b/.test(
        text,
      ) || /\bagent'?s?\b.*\b(phone|number|email|mobile|address)\b/.test(text),
    enquire:
      !isQuestion &&
      /\b(interested|enquire|enquiry|inquire|inquiry|contact|call me|book (?:a )?(?:visit|viewing)|schedule|site visit|talk to|speak (?:to|with)|get in touch|agent|advisor|baat)\b/.test(
        text,
      ),
    help,
    askLocations:
      /\b(which|what) (cities|locations|areas|places|states)\b|\bwhere (do you have|are your|are the)\b|\bwhich city\b/.test(
        text,
      ),
    wantsBudgetSearch: /\b(my|in my|within my) budget\b/.test(text),
    wantsSearch:
      /\b(show|find|search|looking|look for|need|want|properties|property|homes?|listings?|available|have|chahiye|dikhao|ghar|options?)\b/.test(
        text,
      ),
    fields,
    ordinal,
    thisProperty:
      /\b(this|that|the) (property|home|house|flat|apartment|one|listing|place)\b|\bit\b|\bis it\b|\bdoes it\b|\bye\b/.test(
        text,
      ),
    bareAmount: price.bare,
  }
}

export function hasAny(filters: ChatFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined)
}

/** "40 lakh", "1.2 crore", "25,000" — for describing budgets back to visitors. */
export function formatBudget(value: number): string {
  if (value >= 1e7) return `${trim(value / 1e7)} crore`
  if (value >= 1e5) return `${trim(value / 1e5)} lakh`
  return value.toLocaleString('en-IN')
}
const trim = (value: number) => Number(value.toFixed(2)).toString()

const TYPE_PLURAL: Record<PropertyType, string> = {
  house: 'houses',
  apartment: 'apartments',
  townhouse: 'townhouses',
  land: 'land plots',
  commercial: 'commercial properties',
}

/** Human summary of active filters, e.g. "2 BHK apartments for rent in Jaipur under 40 lakh". */
export function describeFilters(filters: ChatFilters): string {
  const parts: string[] = []
  if (filters.featured) parts.push('featured')
  if (filters.bedrooms !== undefined) parts.push(`${filters.bedrooms} BHK`)
  parts.push(
    filters.propertyType ? TYPE_PLURAL[filters.propertyType] : 'properties',
  )
  if (filters.listingType)
    parts.push(filters.listingType === 'rent' ? 'for rent' : 'for sale')
  if (filters.city) parts.push(`in ${filters.city}`)
  if (filters.region) parts.push(`in ${filters.region}`)
  if (filters.query) parts.push(`matching "${filters.query}"`)
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined)
    parts.push(
      `between ${formatBudget(filters.minPrice)} and ${formatBudget(filters.maxPrice)}`,
    )
  else if (filters.maxPrice !== undefined)
    parts.push(`under ${formatBudget(filters.maxPrice)}`)
  else if (filters.minPrice !== undefined)
    parts.push(`above ${formatBudget(filters.minPrice)}`)
  if (filters.minBathrooms !== undefined)
    parts.push(`with ${filters.minBathrooms}+ bathrooms`)
  if (filters.minArea !== undefined)
    parts.push(`of at least ${filters.minArea.toLocaleString('en-IN')} sq ft`)
  if (filters.maxArea !== undefined)
    parts.push(`up to ${filters.maxArea.toLocaleString('en-IN')} sq ft`)
  return parts.join(' ')
}
