import type { CustomerInsert, LeadInsert, PropertyUpdate } from '@/types/domain'
import { updateCustomer } from './customers'
import { updateLead } from './leads'
import { updateProperty } from './properties'

/**
 * Bulk changes go through the single-record services so every row keeps its
 * activity entry, timestamps and triggers, and RLS decides row by row.
 * Each function resolves with the ids that could not be changed.
 */
async function runEach(
  ids: string[],
  work: (id: string) => Promise<unknown>,
): Promise<string[]> {
  const results = await Promise.allSettled(ids.map(work))
  return ids.filter((_, index) => results[index]?.status === 'rejected')
}

export const bulkUpdateLeads = (ids: string[], input: Partial<LeadInsert>) =>
  runEach(ids, (id) => updateLead(id, input))

export const bulkUpdateCustomers = (
  ids: string[],
  input: Partial<CustomerInsert>,
) => runEach(ids, (id) => updateCustomer(id, input))

export const bulkUpdateProperties = (ids: string[], input: PropertyUpdate) =>
  runEach(ids, (id) => updateProperty(id, input))

/** "3 updated." / "2 updated. 1 could not be changed …" */
export function bulkResultMessage(total: number, failed: string[]): string {
  const done = total - failed.length
  return (
    `${done} record${done === 1 ? '' : 's'} updated.` +
    (failed.length
      ? ` ${failed.length} could not be changed (you may not have access to ${failed.length === 1 ? 'it' : 'them'}).`
      : '')
  )
}
