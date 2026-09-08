import type {
  Database,
  EnquiryStatus,
  ListingType,
  ProfileRole,
  PropertySearchRow,
  PropertyStatus,
  PropertyType,
} from './database.generated'

export type {
  Database,
  EnquiryStatus,
  ListingType,
  ProfileRole,
  PropertySearchRow,
  PropertyStatus,
  PropertyType,
}

export type Property = Database['public']['Tables']['properties']['Row']
export type PropertyInsert = Database['public']['Tables']['properties']['Insert']
export type PropertyUpdate = Database['public']['Tables']['properties']['Update']
export type PropertyImage = Database['public']['Tables']['property_images']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Enquiry = Database['public']['Tables']['enquiries']['Row']
export type EnquiryInsert = Database['public']['Tables']['enquiries']['Insert']

export interface PropertyWithRelations extends Property {
  property_images: PropertyImage[]
  agent: Profile | null
}

export interface PropertySearchItem extends Omit<PropertySearchRow, 'total_count'> {
  image_url: string | null
}

export interface PropertySearchFilters {
  query?: string
  listingType?: ListingType
  propertyType?: PropertyType
  city?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  bathrooms?: number
  featured?: boolean
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface DashboardStats {
  totalProperties: number
  publishedProperties: number
  draftProperties: number
  newEnquiries: number
  activeAgents: number
}

export interface ServiceErrorShape {
  message: string
  code?: string
  details?: string
}

export interface ReservedImageUpload {
  imageId: string
  path: string
  token?: string
}

export const PROPERTY_TYPES: Array<{ value: PropertyType; label: string }> = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
]

export const LISTING_TYPES: Array<{ value: ListingType; label: string }> = [
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
]

export const PROPERTY_STATUSES: Array<{
  value: PropertyStatus
  label: string
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

export const ENQUIRY_STATUSES: Array<{ value: EnquiryStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
]
