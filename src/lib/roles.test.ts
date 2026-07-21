import { describe, expect, test } from 'vitest'
import { atLeast, hasRole, isRole, ROLES } from './roles'
import { groupedNavForRole, navForRole, NAV_ITEMS } from '@/config/navigation'

describe('hasRole', () => {
  test('returns true when the role is in the allow list', () => {
    expect(hasRole('manager', ['manager', 'super_admin'])).toBe(true)
  })

  test('returns false when the role is absent from the allow list', () => {
    expect(hasRole('employee', ['manager', 'super_admin'])).toBe(false)
  })

  test('returns false for a null role rather than throwing', () => {
    expect(hasRole(null, ['employee'])).toBe(false)
    expect(hasRole(undefined, ['employee'])).toBe(false)
  })
})

describe('atLeast', () => {
  test('super_admin satisfies every minimum', () => {
    expect(atLeast('super_admin', 'employee')).toBe(true)
    expect(atLeast('super_admin', 'manager')).toBe(true)
    expect(atLeast('super_admin', 'super_admin')).toBe(true)
  })

  test('employee does not satisfy a manager minimum', () => {
    expect(atLeast('employee', 'manager')).toBe(false)
  })

  test('a role satisfies its own level', () => {
    expect(atLeast('manager', 'manager')).toBe(true)
  })

  test('returns false for a null role', () => {
    expect(atLeast(null, 'employee')).toBe(false)
  })
})

describe('isRole', () => {
  test('accepts every declared role', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true)
  })

  test('rejects arbitrary strings and non-strings', () => {
    expect(isRole('admin')).toBe(false)
    expect(isRole('')).toBe(false)
    expect(isRole(null)).toBe(false)
    expect(isRole(42)).toBe(false)
  })
})

describe('navForRole', () => {
  test('employees never see admin-only destinations', () => {
    const paths = navForRole('employee').map((item) => item.to)
    expect(paths).not.toContain('/audit-logs')
    expect(paths).not.toContain('/settings')
    expect(paths).not.toContain('/employees')
    expect(paths).not.toContain('/analytics')
  })

  test('managers see team screens but not company administration', () => {
    const paths = navForRole('manager').map((item) => item.to)
    expect(paths).toContain('/reports')
    expect(paths).toContain('/attendance')
    expect(paths).not.toContain('/settings')
    expect(paths).not.toContain('/audit-logs')
  })

  test('super_admin sees every destination once its gates are open', () => {
    expect(navForRole('super_admin', { crm: true })).toHaveLength(
      NAV_ITEMS.filter((item) => item.roles.includes('super_admin')).length,
    )
  })

  test('a gated destination is hidden until its gate says otherwise', () => {
    // Role is necessary but not sufficient for the pipeline: a super admin
    // with the CRM gate closed still does not see it. Asserting on
    // super_admin specifically, because the tempting shortcut is to let the
    // top role skip gates — and that is how an admin ends up on a screen the
    // database will hand them nothing for.
    expect(navForRole('super_admin').map((item) => item.to)).not.toContain('/leads')
    expect(navForRole('super_admin', { crm: false }).map((item) => item.to)).not.toContain('/leads')
    expect(navForRole('super_admin', { crm: true }).map((item) => item.to)).toContain('/leads')
  })

  test('a marketing employee sees the pipeline; a tech one does not', () => {
    expect(navForRole('employee', { crm: true }).map((item) => item.to)).toContain('/leads')
    expect(navForRole('employee', { crm: false }).map((item) => item.to)).not.toContain('/leads')
  })

  test('closing the CRM gate does not disturb anything else', () => {
    const open = navForRole('manager', { crm: true }).map((item) => item.to)
    const shut = navForRole('manager', { crm: false }).map((item) => item.to)
    expect(open.filter((path) => path !== '/leads')).toEqual(shut)
  })

  test('every role can reach the dashboard', () => {
    for (const role of ROLES) {
      expect(navForRole(role).map((item) => item.to)).toContain('/dashboard')
    }
  })
})

describe('groupedNavForRole', () => {
  test('drops sections that contain no items for the role', () => {
    const sections = groupedNavForRole('employee').map((group) => group.section)
    expect(sections).not.toContain('Admin')
    expect(sections).not.toContain('People')
  })

  test('never emits an empty group', () => {
    for (const role of ROLES) {
      for (const group of groupedNavForRole(role)) {
        expect(group.items.length).toBeGreaterThan(0)
      }
    }
  })

  test('preserves the declared section order', () => {
    const sections = groupedNavForRole('super_admin').map((group) => group.section)
    expect(sections).toEqual([...sections].sort((a, b) => {
      const order = ['Overview', 'Daily', 'Marketing', 'People', 'Insight', 'Workspace', 'Admin']
      return order.indexOf(a) - order.indexOf(b)
    }))
  })
})

describe('navigation integrity', () => {
  test('every nav item declares at least one role', () => {
    for (const item of NAV_ITEMS) {
      expect(item.roles.length).toBeGreaterThan(0)
    }
  })

  test('nav paths are unique', () => {
    const paths = NAV_ITEMS.map((item) => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
