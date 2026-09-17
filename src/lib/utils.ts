import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  value: number,
  currency = 'USD',
  compact = false,
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
}

export function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== undefined && item !== null && item !== '',
    ),
  ) as T
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Something went wrong. Please try again.'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function pageNumbers(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('ellipsis')
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}
