import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type {
  PropertySearchFilters,
  PropertySearchItem,
  PropertyWithRelations,
} from '@/types/domain'

// Only the data layer is mocked; messages go through the real rule engine.
const searchPublicProperties = vi.fn()
const getPublicPropertyBySlug = vi.fn()
const listPublicLocations = vi.fn()
const createEnquiry = vi.fn()
vi.mock('@/services/properties', () => ({
  searchPublicProperties: (...a: unknown[]) => searchPublicProperties(...a),
  getPublicPropertyBySlug: (...a: unknown[]) => getPublicPropertyBySlug(...a),
  listPublicLocations: (...a: unknown[]) => listPublicLocations(...a),
}))
vi.mock('@/services/enquiries', () => ({
  createEnquiry: (...a: unknown[]) => createEnquiry(...a),
}))

const { ChatbotWidget } = await import('./ChatbotWidget')
const { clearAssistantCache } = await import('@/services/chatAssistant')

const property: PropertySearchItem = {
  id: 'p1',
  slug: 'garden-flat',
  title: 'Garden flat',
  excerpt: null,
  property_type: 'apartment',
  listing_type: 'sale',
  price: 4000000,
  currency: 'INR',
  city: 'Jaipur',
  region: 'Rajasthan',
  bedrooms: 2,
  bathrooms: 2,
  parking_spaces: 1,
  floor_area: 950,
  featured: true,
  published_at: null,
  primary_image_path: null,
  primary_image_alt: null,
  image_url: null,
}

const page = (data: PropertySearchItem[]) => ({
  data,
  page: 1,
  pageSize: 6,
  total: data.length,
  totalPages: 1,
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChatbotWidget />
    </MemoryRouter>,
  )
}

async function openChat() {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'Open property assistant' }),
  )
  return user
}

describe('ChatbotWidget', () => {
  beforeEach(() => {
    clearAssistantCache()
    searchPublicProperties.mockReset()
    getPublicPropertyBySlug.mockReset()
    createEnquiry.mockReset()
    listPublicLocations.mockReset()
    listPublicLocations.mockResolvedValue({
      cities: ['Jaipur'],
      regions: ['Rajasthan'],
    })
  })

  it('is not rendered on CRM pages', () => {
    renderAt('/crm/leads')
    expect(
      screen.queryByRole('button', { name: /property assistant/i }),
    ).not.toBeInTheDocument()
  })

  it('opens with a welcome message, suggestions and focused input, and minimises', async () => {
    renderAt('/')
    const user = await openChat()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/I can help you find properties/)).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Properties for rent' }),
    ).toBeVisible()
    expect(
      screen.getByLabelText('Message the property assistant'),
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open property assistant' }),
    ).toHaveFocus()
  })

  it('shows database results as cards and keeps context for refinements', async () => {
    searchPublicProperties.mockResolvedValue(page([property]))
    renderAt('/')
    const user = await openChat()
    await user.click(
      screen.getByRole('button', { name: 'Show 2 BHK properties' }),
    )

    expect(
      await screen.findByText(/I found 1 published match for 2 BHK properties/),
    ).toBeVisible()
    const results = screen.getByRole('list', { name: 'Matching properties' })
    expect(within(results).getByText('Garden flat')).toBeVisible()
    expect(
      within(results).getByRole('link', {
        name: 'View details for Garden flat',
      }),
    ).toHaveAttribute('href', '/properties/garden-flat')

    await user.type(
      screen.getByLabelText('Message the property assistant'),
      'Only rentals{Enter}',
    )
    await waitFor(() => expect(searchPublicProperties).toHaveBeenCalledTimes(2))
    expect(
      searchPublicProperties.mock.calls[1]?.[0] as PropertySearchFilters,
    ).toMatchObject({ bedrooms: 2, maxBedrooms: 2, listingType: 'rent' })
  })

  it('shows an error with a working retry', async () => {
    searchPublicProperties.mockRejectedValueOnce(new Error('Network down'))
    searchPublicProperties.mockResolvedValueOnce(page([property]))
    renderAt('/')
    const user = await openChat()
    await user.click(
      screen.getByRole('button', { name: 'Properties for sale' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    await user.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByText(/I found 1 published match/)).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers refinement quick actions when nothing matches', async () => {
    searchPublicProperties.mockResolvedValue(page([]))
    renderAt('/')
    const user = await openChat()
    await user.type(
      screen.getByLabelText('Message the property assistant'),
      'houses for rent in Jaipur under 10k{Enter}',
    )
    expect(
      await screen.findByText(/I couldn't find a published property/),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Increase my budget' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Search in any location' }),
    ).toBeVisible()
  })

  it('validates and submits an enquiry for a property', async () => {
    searchPublicProperties.mockResolvedValue(page([property]))
    createEnquiry.mockResolvedValueOnce(undefined)
    renderAt('/')
    const user = await openChat()
    await user.click(
      screen.getByRole('button', { name: 'Properties for sale' }),
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Send an enquiry about Garden flat',
      }),
    )
    const form = screen.getByRole('form', {
      name: 'Enquiry about Garden flat',
    })
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }))
    expect(within(form).getByText('Please enter your name.')).toBeVisible()
    expect(
      within(form).getByText('Please enter a valid email address.'),
    ).toBeVisible()
    expect(createEnquiry).not.toHaveBeenCalled()

    await user.type(within(form).getByLabelText('Name'), 'Asha Verma')
    await user.type(within(form).getByLabelText('Email'), 'asha@example.com')
    await user.type(within(form).getByLabelText(/Phone/), '+91 98765 43210')
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }))

    await waitFor(() =>
      expect(createEnquiry).toHaveBeenCalledWith({
        property_id: 'p1',
        name: 'Asha Verma',
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        message: "I'm interested in Garden flat. Please get in touch.",
      }),
    )
    expect(await screen.findByText('Enquiry sent.')).toBeVisible()
  })

  it('shows an enquiry submission error and allows another attempt', async () => {
    createEnquiry.mockRejectedValueOnce(new Error('Database unavailable.'))
    createEnquiry.mockResolvedValueOnce(undefined)
    renderAt('/')
    const user = await openChat()
    await user.click(screen.getByRole('button', { name: 'Contact an agent' }))
    const form = await screen.findByRole('form', { name: 'Enquiry form' })
    await user.type(within(form).getByLabelText('Name'), 'Ravi')
    await user.type(within(form).getByLabelText('Email'), 'ravi@example.com')
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Database unavailable.',
    )
    await user.click(within(form).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Enquiry sent.')).toBeVisible()
    expect(createEnquiry.mock.calls[1]?.[0]).toMatchObject({
      property_id: null,
      phone: null,
    })
  })

  it('answers about the property being viewed on a detail page', async () => {
    getPublicPropertyBySlug.mockResolvedValue({
      ...property,
      description: 'A bright flat near the park with lots of light.',
      address_line_1: '12 MG Road',
      address_line_2: null,
      postal_code: null,
      lot_size: null,
      year_built: null,
      amenities: [],
      property_images: [],
      agent: null,
    } as unknown as PropertyWithRelations)
    renderAt('/properties/garden-flat')
    const user = await openChat()
    await user.click(screen.getByRole('button', { name: 'What is the price?' }))
    expect(
      await screen.findByText('Garden flat: It is listed at ₹4,000,000.'),
    ).toBeVisible()
    expect(getPublicPropertyBySlug).toHaveBeenCalledWith('garden-flat')
  })
})
