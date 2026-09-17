import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'
import type { PropertyImage, ReservedImageUpload } from '@/types/domain'
import { ServiceError, throwIfError } from './service-utils'

export const PROPERTY_IMAGES_BUCKET = 'property-images'

function extensionFromFile(file: File): string {
  const part = file.name.split('.').pop()?.toLowerCase()
  return part && /^[a-z0-9]+$/.test(part) ? part : 'jpg'
}

function parseReservation(value: unknown): ReservedImageUpload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const imageId = record.image_id ?? record.imageId
  const path = record.storage_path ?? record.path
  const token = record.token
  if (typeof imageId !== 'string' || typeof path !== 'string') return null
  return {
    imageId,
    path,
    token: typeof token === 'string' ? token : undefined,
  }
}

export function getPublicImageUrl(path: string | null): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(path).data
    .publicUrl
}

export async function getSignedImageUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn)
  throwIfError(error, 'Unable to load the property image.')
  if (!data?.signedUrl)
    throw new ServiceError('The image URL could not be created.')
  return data.signedUrl
}

export async function reserveImage(
  propertyId: string,
  file: File,
): Promise<ReservedImageUpload> {
  const { data, error } = await supabase.rpc('reserve_property_image', {
    p_property_id: propertyId,
    p_filename: file.name,
    p_content_type: file.type || 'image/jpeg',
  })
  throwIfError(error, 'Unable to reserve image storage.')

  const reservation = parseReservation(data)
  if (reservation) return reservation

  const imageId = crypto.randomUUID()
  const path = `${propertyId}/${imageId}.${extensionFromFile(file)}`
  const { error: insertError } = await supabase.from('property_images').insert({
    id: imageId,
    property_id: propertyId,
    storage_path: path,
    alt_text: file.name.replace(/\.[^.]+$/, ''),
  })
  throwIfError(insertError, 'Unable to reserve image storage.')
  return { imageId, path }
}

export async function uploadPropertyImage(
  propertyId: string,
  file: File,
): Promise<PropertyImage> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
    fileType: file.type || 'image/jpeg',
  })
  const reservation = await reserveImage(propertyId, compressed)
  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .uploadToSignedUrl(reservation.path, reservation.token ?? '', compressed)

  if (uploadError && !reservation.token) {
    const { error: directUploadError } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .upload(reservation.path, compressed, {
        upsert: false,
        cacheControl: '3600',
        contentType: compressed.type,
      })
    throwIfError(directUploadError, 'The image could not be uploaded.')
  } else {
    throwIfError(uploadError, 'The image could not be uploaded.')
  }

  const { data, error } = await supabase
    .from('property_images')
    .select('*')
    .eq('id', reservation.imageId)
    .single()
  throwIfError(error, 'The uploaded image could not be loaded.')
  if (!data) throw new ServiceError('The uploaded image could not be loaded.')
  return data
}

export async function deletePropertyImage(image: PropertyImage): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(PROPERTY_IMAGES_BUCKET)
    .remove([image.storage_path])
  throwIfError(storageError, 'The image file could not be deleted.')

  const { error } = await supabase
    .from('property_images')
    .delete()
    .eq('id', image.id)
  throwIfError(error, 'The image record could not be deleted.')
}

export async function setPrimaryImage(
  propertyId: string,
  imageId: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_primary_property_image', {
    p_property_id: propertyId,
    p_image_id: imageId,
  })
  throwIfError(error, 'The primary image could not be changed.')
}

export async function reorderImages(
  propertyId: string,
  imageIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc('reorder_property_images', {
    p_property_id: propertyId,
    p_image_ids: imageIds,
  })
  throwIfError(error, 'The image order could not be saved.')
}
