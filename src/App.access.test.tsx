import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Profile } from '@/types/domain'

// Access control lives in App (routes + login), so render the real App with
// the data layer mocked.
const getMyProfile = vi.fn()
const signIn = vi.fn()
const signOut = vi.fn()
vi.mock('@/services/auth', () => ({
  getMyProfile: (...a: unknown[]) => getMyProfile(...a),
  signIn: (...a: unknown[]) => signIn(...a),
  signOut: (...a: unknown[]) => signOut(...a),
  signUp: vi.fn(),
}))
vi.mock('@/components/chatbot/ChatbotWidget', () => ({
  ChatbotWidget: () => null,
}))
vi.mock('@/services/dashboard', () => ({
  getDashboardStats: async () => null,
}))
vi.mock('@/services/activities', () => ({
  listActivities: async () => [],
}))
vi.mock('@/services/agents', () => ({
  listAgents: async () => [],
  inviteAgent: vi.fn(),
  setAgentActive: vi.fn(),
  updateAgent: vi.fn(),
}))

const { default: App } = await import('./App')

const profile = (extra: Partial<Profile>): Profile => ({
  id: 'u1',
  full_name: 'Sam Agent',
  email: 'sam@example.com',
  phone: null,
  avatar_url: null,
  role: 'agent',
  active: true,
  created_at: '',
  updated_at: '',
  ...extra,
})

const visit = (path: string) => window.history.pushState({}, '', path)

beforeEach(() => {
  getMyProfile.mockReset()
  signIn.mockReset().mockResolvedValue({})
  signOut.mockReset().mockResolvedValue(undefined)
})

describe('staff access', () => {
  it('sends an inactive (pending) account to the login page', async () => {
    getMyProfile.mockResolvedValue(profile({ active: false }))
    visit('/dashboard')
    render(<App />)
    expect(await screen.findByText('Welcome back.')).toBeVisible()
  })

  it('refuses to sign in a pending account and signs it out again', async () => {
    getMyProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValue(profile({ active: false }))
    visit('/login')
    render(<App />)
    await userEvent.type(
      await screen.findByPlaceholderText('Email address'),
      'sam@example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(
      await screen.findByText(/waiting for an administrator to approve/),
    ).toBeVisible()
    expect(signOut).toHaveBeenCalled()
  })

  it('keeps agents out of admin-only pages and hides the link', async () => {
    getMyProfile.mockResolvedValue(profile({ role: 'agent' }))
    visit('/crm/agents')
    render(<App />)
    expect(await screen.findByText('Good morning.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull()
  })

  it('lets admins open the agents page', async () => {
    getMyProfile.mockResolvedValue(profile({ role: 'admin' }))
    visit('/crm/agents')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Agents' })).toBeVisible()
  })
})
