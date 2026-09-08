import { supabase } from '@/lib/supabase'
import type {
  PaginatedResult,
  Property,
  PropertyImage,
  PropertyInsert,
  PropertySearchFilters,
  PropertySearchItem,
  PropertyStatus,
  PropertyUpdate,
  PropertyWithRelations,
} from '@/types/domain'
import { getPublicImageUrl } from './storage'
import { ServiceError, throwIfError } from './service-utils'

const publicPropertyColumns =
  'id, slug, title, description, excerpt, property_type, listing_type, status, price, currency, address_line_1, address_line_2, city, region, postal_code, country, latitude, longitude, bedrooms, bathrooms, parking_spaces, floor_area, lot_size, year_built, featured, amenities, agent_id, created_by, published_at, created_at, updated_at'

export async function searchPublicProperties(
  filters: PropertySearchFilters,
): Promise<PaginatedResult<PropertySearchItem>> {
  const { data, error } = await supabase.rpc('search_properties', {
    p_query: filters.query || null,
    p_listing_type: filters.listingType ?? null,
    p_property_type: filters.propertyType ?? null,
    p_city: filters.city || null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_min_bedrooms: filters.bedrooms ?? null,
    p_min_bathrooms: filters.bathrooms ?? null,
    p_featured: filters.featured ?? null,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })
  throwIfError(error, 'Properties could not be loaded.')

  const rows = data ?? []
  const total = rows[0]?.total_count ?? 0
  return {
    data: rows.map(({ total_count: _totalCount, ...row }) => ({
      ...row,
      image_url: getPublicImageUrl(row.primary_image_path),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

export async function getFeaturedProperties(limit = 6): Promise<PropertySearchItem[]> {
  const result = await searchPublicProperties({
    featured: true,
    page: 1,
    pageSize: limit,
  })
  return result.data
}

export async function getPublicPropertyBySlug(slug: string): Promise<PropertyWithRelations> {
  const { data: property, error } = await supabase
    .from('properties')
    .select(publicPropertyColumns)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  throwIfError(error, 'The property could not be loaded.')
  if (!property) throw new ServiceError('Property not found.')

  const [imagesResult, profileResult] = await Promise.all([
    supabase
      .from('property_images')
      .select('*')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    property.agent_id
      ? supabase.from('profiles').select('*').eq('id', property.agent_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  throwIfError(imagesResult.error, 'Property images could not be loaded.')
  throwIfError(profileResult.error, 'The listing agent could not be loaded.')

  return {
    ...property,
    property_images: imagesResult.data ?? [],
    agent: profileResult.data,
  }
}

export interface StaffPropertyFilters {
  query?: string
  status?: PropertyStatus
  page: number
  pageSize: number
}

export interface StaffPropertyItem extends Property {
  primaryImage: PropertyImage | null
}

export async function listStaffProperties(
  filters: StaffPropertyFilters,
): Promise<PaginatedResult<StaffPropertyItem>> {
  const start = (filters.page - 1) * filters.pageSize
  const end = start + filters.pageSize - 1
  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(start, end)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.query) {
    const escaped = filters.query.replaceAll(',', ' ')
    query = query.or(`title.ilike.%${escaped}%,city.ilike.%${escaped}%`)
  }

  const { data, error, count } = await query
  throwIfError(error, 'The property workspace could not be loaded.')
  const properties = data ?? []
  const ids = properties.map((property) => property.id)
  let images: PropertyImage[] = []

  if (ids.length > 0) {
    const imageResult = await supabase
      .from('property_images')
      .select('*')
      .in('property_id', ids)
      .eq('is_primary', true)
    throwIfError(imageResult.error, 'Property images could not be loaded.')
    images = imageResult.data ?? []
  }

  const total = count ?? 0
  return {
    data: properties.map((property) => ({
      ...property,
      primaryImage: images.find((image) => image.property_id === property.id) ?? null,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  }
}

export async function getStaffPropertyById(id: string): Promise<PropertyWithRelations> {
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  throwIfError(error, 'The property could not be loaded.')
  if (!property) throw new ServiceError('Property not found.')

  const [imagesResult, profileResult] = await Promise.all([
    supabase
      .from('property_images')
      .select('*')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    property.agent_id
      ? supabase.from('profiles').select('*').eq('id', property.agent_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  throwIfError(imagesResult.error, 'Property images could not be loaded.')
  throwIfError(profileResult.error, 'The listing agent could not be loaded.')

  return {
    ...property,
    property_images: imagesResult.data ?? [],
    agent: profileResult.data,
  }
}

export async function createProperty(input: PropertyInsert): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert(input)
    .select('*')
    .single()
  throwIfError(error, 'The property could not be created.')
  if (!data) throw new ServiceError('The property could not be created.')
  return data
}

export async function updateProperty(id: string, input: PropertyUpdate): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  throwIfError(error, 'The property could not be updated.')
  if (!data) throw new ServiceError('The property could not be updated.')
  return data
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from('properties').delete().eq('id', id)
  throwIfError(error, 'The property could not be deleted.')
}

async function runLifecycle(
  operation: 'publish_property' | 'archive_property' | 'restore_property',
  id: string,
): Promise<Property> {
  const { data, error } = await supabase.rpc(operation, { p_property_id: id })
  throwIfError(error, 'The property status could not be changed.')
  if (!data) throw new ServiceError('The property status could not be changed.')
  return data
}

export const publishProperty = (id: string) => runLifecycle('publish_property', id)
export const archiveProperty = (id: string) => runLifecycle('archive_property', id)
export const restoreProperty = (id: string) => runLifecycle('restore_property', id)
