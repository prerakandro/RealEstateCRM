import { slugify } from './utils'
import { optionalNumber, optionalText, parseAmenities } from './crm'
import type { ListingType, PropertyInsert, PropertyType } from '@/types/domain'

/** Reads the shared property form (see PropertyFields) into a row update. */
export function readPropertyForm(data: FormData): PropertyInsert {
  const text = (key: string) => String(data.get(key) ?? '').trim()
  const count = (key: string) => Math.trunc(optionalNumber(data.get(key)) ?? 0)
  const year = optionalNumber(data.get('year_built'))
  const title = text('title')
  return {
    title,
    slug: slugify(title),
    excerpt: optionalText(data.get('excerpt')),
    description: text('description'),
    property_type: text('property_type') as PropertyType,
    listing_type: text('listing_type') as ListingType,
    price: optionalNumber(data.get('price')) ?? 0,
    currency: text('currency') || 'INR',
    address_line_1: text('address'),
    address_line_2: optionalText(data.get('address_line_2')),
    city: text('city'),
    region: text('region'),
    postal_code: optionalText(data.get('postal_code')),
    country: text('country') || 'IN',
    bedrooms: count('bedrooms'),
    bathrooms: count('bathrooms'),
    parking_spaces: count('parking_spaces'),
    floor_area: optionalNumber(data.get('floor_area')),
    lot_size: optionalNumber(data.get('lot_size')),
    year_built: year === null ? null : Math.trunc(year),
    amenities: parseAmenities(text('amenities')),
    featured: data.get('featured') === 'on',
  }
}
