import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Lead, Profile } from '@/types/domain'

const listLeads = vi.fn()
const updateLead = vi.fn()
const listAgents = vi.fn()
vi.mock('@/services/leads', () => ({
  listLeads: (...a: unknown[]) => listLeads(...a),
  updateLead: (...a: unknown[]) => updateLead(...a),
  createLead: vi.fn(),
}))
vi.mock('@/services/agents', () => ({
  listAgents: (...a: unknown[]) => listAgents(...a),
}))
vi.mock('@/services/lookups', () => ({
  getCustomerNames: async () => ({ c1: 'Asha Rao' }),
  getPropertyTitles: async () => ({ p1: 'Garden flat' }),
  listPropertyOptions: async () => [],
  listCustomerOptions: async () => [],
}))

const bulkUpdateLeads = vi.fn()
vi.mock('@/services/bulk', async (original) => ({
  ...(await original<typeof import('@/services/bulk')>()),
  bulkUpdateLeads: (...a: unknown[]) => bulkUpdateLeads(...a),
}))

const { LeadsPage } = await import('./LeadsPage')

const admin: Profile = {
  id: 'u1',
  full_name: 'Admin User',
  email: 'admin@example.com',
  phone: null,
  avatar_url: null,
  role: 'admin',
  active: true,
  created_at: '',
  updated_at: '',
}

const lead: Lead = {
  id: 'l1',
  customer_id: 'c1',
  property_id: 'p1',
  title: 'Enquiry for garden flat',
  source: 'property_enquiry',
  status: 'new',
  priority: 'high',
  assigned_agent_id: 'u1',
  created_by: null,
  notes: null,
  expected_budget: 4_000_000,
  next_follow_up_at: null,
  contacted_at: null,
  qualified_at: null,
  converted_at: null,
  created_at: '',
  updated_at: '',
}

const renderPage = (url = '/crm/leads') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LeadsPage profile={admin} />
    </MemoryRouter>,
  )

beforeEach(() => {
  listLeads.mockReset().mockResolvedValue({
    data: [lead],
    page: 1,
    pageSize: 25,
    total: 1,
    totalPages: 1,
  })
  updateLead.mockReset().mockResolvedValue({ ...lead, status: 'contacted' })
  listAgents.mockReset().mockResolvedValue([admin])
  bulkUpdateLeads.mockReset().mockResolvedValue([])
})

describe('LeadsPage', () => {
  it('shows customer and property names instead of ids', async () => {
    renderPage()
    expect(await screen.findByText('Enquiry for garden flat')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/crm/customers/c1',
    )
    expect(screen.getByText(/Garden flat/)).toBeVisible()
    expect(screen.queryByText(/Customer c1/)).not.toBeInTheDocument()
  })

  it('moves a lead to another stage from the table', async () => {
    renderPage()
    const stage = await screen.findByRole('combobox', {
      name: 'Stage for Enquiry for garden flat',
    })
    await userEvent.selectOptions(stage, 'contacted')
    expect(updateLead).toHaveBeenCalledWith('l1', { status: 'contacted' })
  })

  it('shows every pipeline stage on the board and loads all stages', async () => {
    renderPage('/crm/leads?view=board&status=qualified')
    const board = await screen.findByLabelText('Lead pipeline board')
    expect(within(board).getByLabelText('New leads')).toBeVisible()
    expect(within(board).getByLabelText('Converted leads')).toBeVisible()
    expect(within(board).getByText('Enquiry for garden flat')).toBeVisible()
    // The stage filter is ignored on the board so no column is hidden.
    expect(listLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: undefined, pageSize: 300 }),
    )
  })

  it('passes filters from the URL to the service', async () => {
    renderPage('/crm/leads?priority=urgent&q=villa&page=2')
    await screen.findByText('Enquiry for garden flat')
    expect(listLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: 'urgent', query: 'villa', page: 2 }),
    )
  })

  it('changes the stage of every selected lead at once', async () => {
    renderPage()
    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Select all leads on this page',
      }),
    )
    const bar = screen.getByRole('region', { name: 'Bulk actions' })
    expect(within(bar).getByText('1 selected')).toBeVisible()
    await userEvent.selectOptions(
      within(bar).getByRole('combobox', { name: 'Move to stage' }),
      'negotiation',
    )
    expect(bulkUpdateLeads).toHaveBeenCalledWith(['l1'], {
      status: 'negotiation',
    })
    expect(await screen.findByText('1 record updated.')).toBeVisible()
  })

  it('reads the advanced filters from the URL', async () => {
    renderPage(
      '/crm/leads?from=2026-10-01&to=2026-10-07&min=3000000&due=overdue',
    )
    await screen.findByText('Enquiry for garden flat')
    const filters = listLeads.mock.lastCall?.[0]
    expect(filters).toMatchObject({ minBudget: 3_000_000, followUp: 'overdue' })
    expect(new Date(filters.createdFrom).getDate()).toBe(1)
    // 'to' includes the whole day: the bound is the next midnight.
    expect(new Date(filters.createdTo).getDate()).toBe(8)
    expect(screen.getByRole('button', { name: 'Fewer filters' })).toBeVisible()
  })
})
