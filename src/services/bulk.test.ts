import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateLead = vi.fn()
vi.mock('./leads', () => ({
  updateLead: (...a: unknown[]) => updateLead(...a),
}))
vi.mock('./customers', () => ({ updateCustomer: vi.fn() }))
vi.mock('./properties', () => ({ updateProperty: vi.fn() }))

const { bulkResultMessage, bulkUpdateLeads } = await import('./bulk')

beforeEach(() => updateLead.mockReset())

describe('bulkUpdateLeads', () => {
  it('updates every record and reports the ones that failed', async () => {
    updateLead.mockImplementation(async (id: string) => {
      if (id === 'l2') throw new Error('RLS')
      return { id }
    })
    const failed = await bulkUpdateLeads(['l1', 'l2', 'l3'], {
      status: 'contacted',
    })
    expect(updateLead).toHaveBeenCalledTimes(3)
    expect(updateLead).toHaveBeenCalledWith('l1', { status: 'contacted' })
    expect(failed).toEqual(['l2'])
  })
})

describe('bulkResultMessage', () => {
  it('summarises successes and failures', () => {
    expect(bulkResultMessage(3, [])).toBe('3 records updated.')
    expect(bulkResultMessage(3, ['x'])).toBe(
      '2 records updated. 1 could not be changed (you may not have access to it).',
    )
  })
})
