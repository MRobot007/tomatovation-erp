# Tomatovation ERP — Features

An internal ERP for a 50–500 person company: attendance and time tracking,
work logging, tasks, leave, a marketing CRM, people management, and reporting —
in one role-aware workspace.

Three roles run through everything: **Super Admin**, **Manager**, and
**Employee**. What each person sees, and what they can change, is decided by
their role (and, for the pipeline, their department).

---

## Attendance & time

- **Punch in / out from a single dial** — tap to start your shift, tap again to
  stop. The timer counts the current shift from zero.
- **Multiple shifts a day** — leave for a site visit and come back; punching out
  is not the end of the day. Each punch-in starts a fresh count, and every
  session is recorded.
- **Breaks** — pause the clock for a break; break time is deducted from the day
  automatically.
- **Session breakdown** — every punch-in/out pair of the day, with a running
  total, in a collapsible list.
- **Lateness, worked hours and overtime** are calculated by the system on punch
  out (never entered by hand), against the configured work day and grace period.
- **Automatic midnight close** — a shift left running is closed at end of day so
  a forgotten punch-out never inflates hours; the employee and their manager are
  notified to correct it.
- **Device & location capture** — each punch records the device/browser and,
  when granted, the coordinates.
- **World clocks** — the office clock alongside Prague and New York, each showing
  whether it is working hours there and when it is a different day.
- **Team attendance** (managers/admins) — who is present, late, on leave, and how
  many hours, for any date.
- **My attendance history** — an employee's own record of past days.

## Work logs

- Employees log the work they did, with hours; managers and admins review it.
- **Review workflow** — a manager can approve a log or send it back with a note
  for changes.

## Tasks

- Assign tasks with a priority, deadline, and owner.
- **Status flow** — track a task from open through to done or cancelled.
- **Completion notifications** — when an employee marks a task done, their
  manager and the super admin are told automatically.
- Overdue tasks are surfaced on the dashboard and in reports.

## Leave

- Employees request leave; managers and admins approve or reject it.
- Pending requests awaiting approval are surfaced to managers.
- Leave is reflected in team attendance and the dashboard's "on leave" count.

## Marketing / CRM (Leads)

- **Pipeline** of leads with company, contact, value, status, priority, source,
  next follow-up, and notes.
- **Kanban board** and a filterable list view.
- **Follow-ups due** — what each lead is waiting on, surfaced on the dashboard.
- **Import** leads from Excel (.xlsx) or CSV, with a downloadable template and a
  preview that flags problems before anything is saved. Phone numbers, contact
  details and dates in messy real-world formats are cleaned up rather than
  rejected.
- **Export** the current filtered view to Excel or CSV — the rows in the file
  always match what the filters show.
- **Activity timeline** per lead (calls, notes, status changes).
- **Department-gated access** — the pipeline is visible only to managers, super
  admins, and employees in a department flagged for CRM (e.g. Marketing); other
  staff cannot see it at all. Enforced at the database, not just hidden in the UI.

## People management

- **Create employees** — a super admin provisions an account directly and gets a
  one-time temporary password to hand over; no email delivery required.
- **Edit** name, role, department, reporting line, phone, and status.
- **Reset an employee's password** without knowing the old one, for someone who
  is locked out. Generates a strong password or takes one you choose; recorded in
  the audit log.
- **Deactivate / reactivate** accounts; deactivated staff cannot sign in but
  their history is kept.
- **Departments** — pick from a managed list when assigning someone, or create a
  new department inline. Case-insensitive, so no duplicate spellings.
- **Managers** — see reporting lines and who reports to whom.
- **Change your own password** from your profile.

## Insight & reporting

- **Dashboard** — a role-aware daily overview: attendance, tasks, follow-ups, and
  (for managers) present/working/on-leave counts and an attention panel.
- **Reports** — key figures for a chosen date range, exportable to CSV.
- **Analytics** — headline KPIs plus charts for attendance, working hours, the
  lead funnel, daily leads, and top performers, over any date range. Every figure
  is aggregated by the database.
- **Realtime board** — live team presence (who is working, on a break, or
  offline right now).
- **Print / PDF** — reports and analytics can be printed straight from the
  browser.

## Communication

- **Announcements** — company-wide posts; managers and admins publish, everyone
  reads.
- **Notifications** — in-app alerts (task completions, auto punch-outs, and more)
  delivered in realtime, with an unread badge.

## Administration

- **Audit log** — every meaningful change (who, what, when) for super admins.
- **Settings** — organisation timezone, work-day hours, the late grace period,
  standard/overtime thresholds, and other policy that the calculations read from.

## Access control & security

- **Role-based access** throughout, enforced by Postgres Row-Level Security — the
  database is the boundary, so hiding a link is never the only guard.
- **Invite-only accounts** — public sign-up is closed. An account exists only
  because an administrator created it.
- **Reporting-line scoping** — a manager sees their own direct reports'
  attendance, work logs and leave, and no one else's.
- **Locked timestamps** — employees cannot backdate their own punches to erase
  lateness; attendance times are written only by the punch actions.
- **Privileged actions** (creating employees, resetting passwords) run in
  server-side functions that re-check the caller's role against the database.
- **File storage** for attachments is scoped so people reach only their own files.

## Platform

- **Web app** built with React 18, TypeScript and Vite; TanStack Query for data,
  React Hook Form + Zod for every form, Recharts for charts.
- **Supabase** back end — Postgres, Auth, Row-Level Security, Storage, Realtime,
  and Edge Functions.
- **Design** — a monochrome black-glass card system on a clean page, with the
  brand logo, a machined-metal navigation rail, and considered motion.
- **Light and dark themes**, chosen from the user menu.
- **Mobile-friendly** — the whole app adapts to phone screens: the sidebar
  becomes a drawer, actions stay reachable on touch, and nothing scrolls sideways.
- **Command palette** (⌘K) for fast navigation and search.
