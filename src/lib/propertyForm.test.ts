import { describe, expect, it } from 'vitest'
import { readPropertyForm } from './propertyForm'

const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe('readPropertyForm', () => {
  it('reads every listing field with sensible types', () => {
    const result = readPropertyForm(
      form({
        title: '  Garden Villa  ',
        excerpt: '',
        description: 'A calm villa with a private garden and terrace.',
        property_type: 'house',
        listing_type: 'sale',
        price: '12500000',
        currency: 'INR',
        address: '14 Civil Lines',
        address_line_2: '',
        city: 'Jaipur',
        region: 'Rajasthan',
        postal_code: '302006',
        country: 'IN',
        bedrooms: '4',
        bathrooms: '3',
        parking_spaces: '2',
        floor_area: '2400.5',
        lot_size: '',
        year_built: '2019',
        amenities: 'Garden, Solar, garden',
        featured: 'on',
      }),
    )
    expect(result).toMatchObject({
      title: 'Garden Villa',
      slug: 'garden-villa',
      excerpt: null,
      price: 12_500_000,
      address_line_1: '14 Civil Lines',
      address_line_2: null,
      postal_code: '302006',
      bedrooms: 4,
      parking_spaces: 2,
      floor_area: 2400.5,
      lot_size: null,
      year_built: 2019,
      amenities: ['Garden', 'Solar'],
      featured: true,
    })
  })

  it('defaults missing optional values instead of sending junk', () => {
    const result = readPropertyForm(
      form({ title: 'Plot', bedrooms: '-2', floor_area: 'abc' }),
    )
    expect(result).toMatchObject({
      currency: 'INR',
      country: 'IN',
      bedrooms: 0,
      parking_spaces: 0,
      floor_area: null,
      year_built: null,
      amenities: [],
      featured: false,
    })
  })
})
