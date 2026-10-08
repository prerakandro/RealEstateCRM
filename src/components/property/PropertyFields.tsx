import { CURRENCIES } from '@/lib/crm'
import type { Profile, Property } from '@/types/domain'
import { LISTING_TYPES, PROPERTY_TYPES } from '@/types/domain'

/**
 * Every editable listing field, shared by "Add listing" and the editor.
 * Read the submitted form with readPropertyForm (src/lib/propertyForm.ts).
 */
export function PropertyFields({
  property,
  agents,
  profile,
}: {
  property?: Property
  agents: Profile[]
  profile: Profile
}) {
  return (
    <>
      <fieldset>
        <legend>Listing</legend>
        <label>
          Property title
          <input
            required
            minLength={3}
            maxLength={180}
            name="title"
            defaultValue={property?.title}
          />
        </label>
        <label>
          Short summary (shown on cards and search results)
          <input
            name="excerpt"
            maxLength={220}
            defaultValue={property?.excerpt ?? ''}
          />
        </label>
        <label>
          Description
          <textarea
            required
            minLength={20}
            name="description"
            defaultValue={property?.description}
          />
        </label>
        <div>
          <label>
            Property type
            <select
              name="property_type"
              defaultValue={property?.property_type ?? 'apartment'}
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
            <select
              name="listing_type"
              defaultValue={property?.listing_type ?? 'sale'}
            >
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
              step="any"
              defaultValue={property?.price}
            />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue={property?.currency ?? 'INR'}>
              {[...new Set([...CURRENCIES, property?.currency ?? 'INR'])].map(
                (code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ),
              )}
            </select>
          </label>
          {profile.role === 'admin' && (
            <label>
              Listing agent
              <select
                name="agent_id"
                defaultValue={property?.agent_id ?? profile.id}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                    {agent.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>Location</legend>
        <label>
          Address
          <input
            required
            name="address"
            defaultValue={property?.address_line_1}
          />
        </label>
        <label>
          Address line 2 / locality
          <input
            name="address_line_2"
            defaultValue={property?.address_line_2 ?? ''}
          />
        </label>
        <div>
          <label>
            City
            <input required name="city" defaultValue={property?.city} />
          </label>
          <label>
            State / region
            <input required name="region" defaultValue={property?.region} />
          </label>
          <label>
            PIN / postal code
            <input
              name="postal_code"
              defaultValue={property?.postal_code ?? ''}
            />
          </label>
          <label>
            Country code
            <input
              name="country"
              maxLength={2}
              defaultValue={property?.country ?? 'IN'}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Details</legend>
        <div>
          <label>
            Bedrooms
            <input
              name="bedrooms"
              type="number"
              min="0"
              defaultValue={property?.bedrooms ?? 0}
            />
          </label>
          <label>
            Bathrooms
            <input
              name="bathrooms"
              type="number"
              min="0"
              defaultValue={property?.bathrooms ?? 0}
            />
          </label>
          <label>
            Parking spaces
            <input
              name="parking_spaces"
              type="number"
              min="0"
              defaultValue={property?.parking_spaces ?? 0}
            />
          </label>
          <label>
            Built-up area (sq ft)
            <input
              name="floor_area"
              type="number"
              min="0"
              step="any"
              defaultValue={property?.floor_area ?? ''}
            />
          </label>
          <label>
            Plot size (sq ft)
            <input
              name="lot_size"
              type="number"
              min="0"
              step="any"
              defaultValue={property?.lot_size ?? ''}
            />
          </label>
          <label>
            Year built
            <input
              name="year_built"
              type="number"
              min="1800"
              max={new Date().getFullYear() + 5}
              defaultValue={property?.year_built ?? ''}
            />
          </label>
        </div>
        <label>
          Amenities (comma separated)
          <textarea
            name="amenities"
            className="short"
            placeholder="Lift, Power backup, Gym, Swimming pool, Covered parking"
            defaultValue={property?.amenities.join(', ') ?? ''}
          />
        </label>
        <label className="check">
          <input
            name="featured"
            type="checkbox"
            defaultChecked={property?.featured ?? false}
          />{' '}
          Feature this property on the home page
        </label>
      </fieldset>
    </>
  )
}
