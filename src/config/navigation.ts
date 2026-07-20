import {
  LayoutDashboard,
  Users,
  UserCog,
  Megaphone,
  CalendarCheck,
  NotebookPen,
  CalendarDays,
  FileBarChart,
  ChartLine,
  Settings,
  ScrollText,
  Radio,
  Target,
  ListChecks,
  Timer,
  Bell,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/roles'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles: readonly Role[]
  /** Optional grouping heading rendered above the item in the sidebar. */
  section: string
}

/**
 * Single source of truth for the sidebar. Routes read their guard list from the
 * same array, so a link can never appear without a matching route guard —
 * the two drifting apart is the classic way role UIs leak.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // --- Overview -------------------------------------------------------------
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Overview',
  },

  // --- Daily ----------------------------------------------------------------
  {
    label: 'Punch In / Out',
    to: '/attendance/me',
    icon: Timer,
    roles: ['employee', 'manager'],
    section: 'Daily',
  },
  {
    label: 'Attendance',
    to: '/attendance',
    icon: CalendarCheck,
    roles: ['super_admin', 'manager'],
    section: 'Daily',
  },
  {
    label: 'Work Logs',
    to: '/work-logs',
    icon: NotebookPen,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Daily',
  },
  {
    label: 'Tasks',
    to: '/tasks',
    icon: ListChecks,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Daily',
  },
  {
    label: 'Leave',
    to: '/leaves',
    icon: CalendarDays,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Daily',
  },

  // --- Marketing ------------------------------------------------------------
  {
    label: 'Leads',
    to: '/leads',
    icon: Target,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Marketing',
  },

  // --- People ---------------------------------------------------------------
  {
    label: 'Employees',
    to: '/employees',
    icon: Users,
    roles: ['super_admin'],
    section: 'People',
  },
  {
    label: 'Managers',
    to: '/managers',
    icon: UserCog,
    roles: ['super_admin'],
    section: 'People',
  },

  // --- Insight --------------------------------------------------------------
  {
    label: 'Reports',
    to: '/reports',
    icon: FileBarChart,
    roles: ['super_admin', 'manager'],
    section: 'Insight',
  },
  {
    label: 'Analytics',
    to: '/analytics',
    icon: ChartLine,
    roles: ['super_admin'],
    section: 'Insight',
  },

  // --- Workspace ------------------------------------------------------------
  {
    label: 'Announcements',
    to: '/announcements',
    icon: Megaphone,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Workspace',
  },
  {
    label: 'Notifications',
    to: '/notifications',
    icon: Bell,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Workspace',
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: UserRound,
    roles: ['super_admin', 'manager', 'employee'],
    section: 'Workspace',
  },

  // --- Admin ----------------------------------------------------------------
  {
    label: 'Audit Logs',
    to: '/audit-logs',
    icon: ScrollText,
    roles: ['super_admin'],
    section: 'Admin',
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    roles: ['super_admin'],
    section: 'Admin',
  },
  {
    label: 'Realtime Board',
    to: '/live',
    icon: Radio,
    roles: ['super_admin', 'manager'],
    section: 'Admin',
  },
]

export const SECTION_ORDER = [
  'Overview',
  'Daily',
  'Marketing',
  'People',
  'Insight',
  'Workspace',
  'Admin',
] as const

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

/** Groups a role's items into ordered sections, dropping any that end up empty. */
export function groupedNavForRole(role: Role): Array<{ section: string; items: NavItem[] }> {
  const visible = navForRole(role)
  return SECTION_ORDER.map((section) => ({
    section,
    items: visible.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0)
}
