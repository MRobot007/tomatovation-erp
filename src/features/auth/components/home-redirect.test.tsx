import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HomeRedirect } from './home-redirect'
import type { Role } from '@/lib/roles'

/**
 * Which screen a role lands on is a product decision, and the kind that gets
 * quietly reverted by an unrelated refactor. Asserting on the destination that
 * actually renders — rather than on the component's internals — means the test
 * still holds if the redirect is reimplemented some other way.
 */

const mockUseAuth = vi.fn()
vi.mock('../auth-context', () => ({ useAuth: () => mockUseAuth() }))

function landingFor(role: Role | null): string {
  mockUseAuth.mockReturnValue({ role })

  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="/attendance/me" element={<p>punch</p>} />
      </Routes>
    </MemoryRouter>,
  )

  return screen.getByText(/dashboard|punch/).textContent ?? ''
}

describe('HomeRedirect', () => {
  test('sends an employee straight to punch in / out', () => {
    expect(landingFor('employee')).toBe('punch')
  })

  test('sends a manager to the dashboard', () => {
    expect(landingFor('manager')).toBe('dashboard')
  })

  test('sends a super admin to the dashboard', () => {
    expect(landingFor('super_admin')).toBe('dashboard')
  })

  test('falls back to punch in / out when the role is somehow absent', () => {
    // ProtectedRoute resolves the profile first so this should not happen. If
    // it ever does, the punch screen is the safer landing: every role can
    // reach it, whereas an unknown role on a manager screen reads as a leak.
    expect(landingFor(null)).toBe('punch')
  })
})
