import { env } from './env'

export const brand = {
  name: 'Haven & Key',
  legalName: 'Haven & Key Real Estate',
  description:
    'Considered homes, clear guidance, and a simpler way to make your next move.',
  phone: '+1 (415) 555-0148',
  email: 'hello@havenandkey.com',
  location: 'San Francisco, California',
}

export function absoluteUrl(path = '/') {
  return new URL(path, env.siteUrl).toString()
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: brand.legalName,
    url: absoluteUrl('/'),
    email: brand.email,
    telephone: brand.phone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      addressCountry: 'US',
    },
  }
}
