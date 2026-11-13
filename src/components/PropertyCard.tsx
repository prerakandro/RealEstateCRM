import type { PropertySearchItem } from '@/types/domain'

interface PropertyCardProps {
  property: PropertySearchItem
  compact?: boolean
  onNavigate?: () => void
  footer?: React.ReactNode
}

export function PropertyCard({
  property,
  compact,
  onNavigate,
  footer,
}: PropertyCardProps) {
  return null
}
