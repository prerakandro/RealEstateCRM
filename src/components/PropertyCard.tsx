import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bath, BedDouble, Home, MapPin } from 'lucide-react'
import { cn, formatCurrency, titleCase } from '@/lib/utils'
import type { PropertySearchItem } from '@/types/domain'

interface PropertyCardProps {
  property: PropertySearchItem
  compact?: boolean
  onNavigate?: () => void
  footer?: ReactNode
}

export function PropertyCard({
  property: p,
  compact = false,
  onNavigate,
  footer,
}: PropertyCardProps) {
  const href = `/properties/${p.slug}`
  return (
    <article className={cn('property', compact && 'property-compact')}>
      <Link
        className="property-image"
        to={href}
        onClick={onNavigate}
        tabIndex={compact ? -1 : undefined}
        aria-hidden={compact || undefined}
      >
        {p.image_url ? (
          <img src={p.image_url} alt={p.primary_image_alt || p.title} />
        ) : (
          <div className="fallback">
            <Home />
          </div>
        )}
        {p.featured && <span>Featured</span>}
      </Link>
      <div>
        <p className="kind">
          {titleCase(p.property_type)} ·{' '}
          {p.listing_type === 'sale' ? 'For sale' : 'For rent'}
        </p>
        <h3>
          <Link to={href} onClick={onNavigate}>
            {p.title}
          </Link>
        </h3>
        <strong>
          {formatCurrency(p.price, p.currency)}
          {p.listing_type === 'rent' && <small>/month</small>}
        </strong>
        <p className="facts">
          <BedDouble /> {p.bedrooms} beds <Bath /> {p.bathrooms} baths{' '}
          {p.floor_area && <> · {p.floor_area.toLocaleString()} sq ft</>}
        </p>
        <p className="location">
          <MapPin /> {p.city}, {p.region}
        </p>
        {footer}
      </div>
    </article>
  )
}
