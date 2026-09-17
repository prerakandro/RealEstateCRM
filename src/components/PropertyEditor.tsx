import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getErrorMessage, slugify } from '@/lib/utils'
import {
  archiveProperty,
  deleteProperty,
  getStaffPropertyById,
  publishProperty,
  updateProperty,
} from '@/services/properties'
import {
  deletePropertyImage,
  getPublicImageUrl,
  setPrimaryImage,
  uploadPropertyImage,
} from '@/services/storage'
import type { Profile, PropertyWithRelations } from '@/types/domain'
import { LISTING_TYPES, PROPERTY_TYPES } from '@/types/domain'

export function PropertyEditor({
  id,
  profile,
}: {
  id: string
  profile: Profile
}) {
  const navigate = useNavigate()
  const [property, setProperty] = useState<PropertyWithRelations | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = () =>
    getStaffPropertyById(id)
      .then(setProperty)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [id])
  if (!property)
    return <div className="loading">{error || 'Loading property…'}</div>
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await work()
      await refresh()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const title = String(data.get('title'))
    perform(() =>
      updateProperty(id, {
        title,
        slug: slugify(title),
        description: String(data.get('description')),
        property_type: String(data.get('property_type')) as never,
        listing_type: String(data.get('listing_type')) as never,
        price: Number(data.get('price')),
        address_line_1: String(data.get('address')),
        city: String(data.get('city')),
        region: String(data.get('region')),
        bedrooms: Number(data.get('bedrooms')),
        bathrooms: Number(data.get('bathrooms')),
        featured: data.get('featured') === 'on',
        agent_id:
          profile.role === 'admin'
            ? String(data.get('agent_id')) || null
            : profile.id,
      }),
    )
  }
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Property workspace</p>
          <h1>{property.title}</h1>
        </div>
        <div className="action-row">
          <Link to={`/properties/${property.slug}`} target="_blank">
            <Button variant="secondary">View public page</Button>
          </Link>
          {property.status === 'published' ? (
            <Button
              loading={busy}
              variant="secondary"
              onClick={() => perform(() => archiveProperty(id))}
            >
              Archive
            </Button>
          ) : (
            <Button
              loading={busy}
              onClick={() => perform(() => publishProperty(id))}
            >
              Publish
            </Button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="editor-layout">
        <form className="property-form" onSubmit={submit}>
          <label>
            Property title
            <input required name="title" defaultValue={property.title} />
          </label>
          <label>
            Description
            <textarea
              required
              minLength={20}
              name="description"
              defaultValue={property.description}
            />
          </label>
          <div>
            <label>
              Property type
              <select
                name="property_type"
                defaultValue={property.property_type}
              >
                {PROPERTY_TYPES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Listing type
              <select name="listing_type" defaultValue={property.listing_type}>
                {LISTING_TYPES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Price
              <input
                required
                name="price"
                type="number"
                min="0"
                defaultValue={property.price}
              />
            </label>
            <label>
              Bedrooms
              <input
                name="bedrooms"
                type="number"
                min="0"
                defaultValue={property.bedrooms}
              />
            </label>
            <label>
              Bathrooms
              <input
                name="bathrooms"
                type="number"
                min="0"
                defaultValue={property.bathrooms}
              />
            </label>
            <label>
              Address
              <input
                required
                name="address"
                defaultValue={property.address_line_1}
              />
            </label>
            <label>
              City
              <input required name="city" defaultValue={property.city} />
            </label>
            <label>
              State / region
              <input required name="region" defaultValue={property.region} />
            </label>
          </div>
          <label className="check">
            <input
              name="featured"
              type="checkbox"
              defaultChecked={property.featured}
            />{' '}
            Feature this property
          </label>
          <div className="action-row">
            <Button type="submit" loading={busy}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Permanently delete this property?'))
                  perform(async () => {
                    await deleteProperty(id)
                    navigate('/crm/properties')
                  })
              }}
            >
              Delete
            </Button>
          </div>
        </form>
        <section className="image-manager">
          <h2>Property images</h2>
          <p>Upload JPEG, PNG or WebP images up to 5MB.</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              perform(async () => {
                for (const file of files) await uploadPropertyImage(id, file)
              })
              e.currentTarget.value = ''
            }}
          />
          <div className="image-list">
            {property.property_images.map((image) => (
              <div key={image.id}>
                <img
                  src={getPublicImageUrl(image.storage_path) || ''}
                  alt={image.alt_text || property.title}
                />
                <span>{image.is_primary ? 'Primary' : ''}</span>
                <button
                  onClick={() => perform(() => setPrimaryImage(id, image.id))}
                >
                  Make primary
                </button>
                <button
                  onClick={() => perform(() => deletePropertyImage(image))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
