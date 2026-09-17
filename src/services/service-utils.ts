import type { PostgrestError } from '@supabase/supabase-js'

export type SupabaseError = PostgrestError | Error | null

export class ServiceError extends Error {
  code?: string
  details?: string

  constructor(message: string, cause?: SupabaseError) {
    super(message)
    this.name = 'ServiceError'
    if (cause && typeof cause === 'object' && 'code' in cause)
      this.code = cause.code
    if (cause && typeof cause === 'object' && 'details' in cause)
      this.details = cause.details
    this.cause = cause ?? undefined
  }
}

export function throwIfError(error: SupabaseError, fallback: string): void {
  if (error) throw new ServiceError(error.message || fallback, error)
}
