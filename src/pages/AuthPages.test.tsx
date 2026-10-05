import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, vi, describe, expect, it } from 'vitest'
import { LoginPage } from './AuthPages'
import { setLanguage } from '../lib/i18n'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('../context/AuthProvider', () => ({
  useAuthState: () => ({
    role: null,
    authError: null,
    refresh: vi.fn(),
    signOut: vi.fn(),
  }),
}))

describe('login page variants', () => {
  beforeAll(async () => {
    await setLanguage('en')
  })

  it('renders the customer title and account recovery links', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin login' })).not.toBeInTheDocument()
  })

  it('renders the admin title without customer account links', () => {
    render(<MemoryRouter><LoginPage admin /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument()
  })
})
