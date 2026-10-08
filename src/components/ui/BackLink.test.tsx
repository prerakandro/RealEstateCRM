import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackLink } from './BackLink'

const app = (entries: string[]) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/crm/leads" element={<h1>All leads page</h1>} />
        <Route path="/crm/leads/l1" element={<h1>Lead page</h1>} />
        <Route
          path="/crm/customers/c1"
          element={
            <BackLink fallback="/crm/customers" fallbackLabel="All customers" />
          }
        />
        <Route path="/crm/customers" element={<h1>All customers page</h1>} />
      </Routes>
    </MemoryRouter>,
  )

describe('BackLink', () => {
  it('returns to the page the user came from', async () => {
    app(['/crm/leads/l1', '/crm/customers/c1'])
    await userEvent.click(screen.getByRole('link', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Lead page' })).toBeVisible()
  })

  it('falls back to the list when opened directly', async () => {
    app(['/crm/customers/c1'])
    await userEvent.click(screen.getByRole('link', { name: 'All customers' }))
    expect(
      screen.getByRole('heading', { name: 'All customers page' }),
    ).toBeVisible()
  })
})
