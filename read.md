# BUILD PROMPT — Employee Management & Marketing CRM ERP

You are building a production-grade internal ERP for a company of 50–500 employees.
Build it end to end. Do not stop to ask for confirmation on obvious decisions — pick
the sane default, note it, and keep going.

---

## 1. Stack (locked — do not substitute)

**Frontend**
- React 18 + TypeScript (Vite)
- Tailwind CSS
- shadcn/ui (Radix primitives)
- React Router v6
- TanStack Query v5 for all server state
- react-hook-form + zod for every form
- Recharts for analytics

**Backend (BaaS)**
- Supabase: Postgres, Auth, Row Level Security, Storage, Realtime, Edge Functions

**Deployment**
- Vercel (frontend), Supabase (backend)

Do not introduce Redux, Zustand, or a custom auth layer. Server state lives in
TanStack Query; URL state lives in search params.

---

## 2. Roles

Three roles: `super_admin`, `manager`, `employee`. Stored on `profiles.role`.
Sidebar, routes, and RLS policies are all driven from this single field.

| Super Admin | Manager | Employee |
|---|---|---|
| Dashboard | Team Dashboard | Dashboard |
| Employee Management | Team Attendance | Punch In/Out |
| Managers | Team Work Logs | My Attendance |
| Marketing | Team Tasks | Work Log |
| Attendance | Approve Leaves | My Tasks |
| Work Logs | Marketing Leads | Marketing Leads |
| Leave Management | Reports | Apply Leave |
| Reports | Team Performance | Profile |
| Analytics | | Notifications |
| Settings | | |
| Audit Logs | | |
| Announcements | | |

Route guarding is **not** cosmetic. Every table is protected by RLS as the real
boundary; the UI guard is convenience only.

---

## 3. Auth & session

- Email + password via Supabase Auth.
- On success: store session (Supabase handles persistence), fetch `profiles` row,
  hydrate an `AuthContext` with `{ user, profile, role }`.
- On revisit: check existing session first → auto-login → dashboard. No re-entry
  of credentials until logout or expiry.
- `<ProtectedRoute allowedRoles={[...]}>` wrapper. Unauthorized → `/403`, not a
  blank screen.
- Password reset flow included.

---

## 4. Database schema (Supabase / Postgres)

Write real SQL migrations under `supabase/migrations/`. Every table gets RLS
enabled and explicit policies — never leave a table open.

```
profiles(id uuid pk → auth.users, name, email, role, department,
         manager_id uuid → profiles, phone, profile_photo, status,
         created_at)

attendance(id, employee_id → profiles, date, punch_in timestamptz,
           punch_out timestamptz, break_minutes int, working_hours numeric,
           status, punch_in_lat, punch_in_lng, device, browser,
           unique(employee_id, date))

work_logs(id, employee_id, project, task, description, hours numeric,
          status, attachment, achievement, tomorrow_plan, created_at)

tasks(id, title, description, assigned_to, assigned_by, priority,
      deadline, status, created_at)

leaves(id, employee_id, leave_type, reason, start_date, end_date,
       status, approved_by, attachment, created_at)

leads(id, company, contact_name, phone, email, source, assigned_to,
      status, priority, remarks, next_followup date, created_at)

lead_activities(id, lead_id → leads, employee_id, activity, remarks, created_at)

announcements(id, title, message, created_by, created_at)

notifications(id, user_id, title, message, type, read bool, created_at)

audit_logs(id, user_id, action, module, record_id, ip_address, browser, created_at)
```

**RLS rules to implement:**
- Employee: sees only rows where `employee_id = auth.uid()` (plus leads assigned to them).
- Manager: sees own rows + rows of anyone whose `profiles.manager_id = auth.uid()`.
  Implement via a `SECURITY DEFINER` helper function to avoid recursive policy lookups.
- Super admin: full read; writes still audited.
- `audit_logs`: insert-only for everyone, select for super_admin only.

Add indexes on every foreign key and on `attendance(employee_id, date)`,
`leads(assigned_to, next_followup)`, `notifications(user_id, read)`.

---

## 5. Feature specs

### Attendance
- One primary button that toggles Punch In → Punch Out based on today's row.
- Captures date, time, employee id, optional GPS (ask permission, never block on
  denial), device and browser from user agent.
- Status transitions: `Not Started → Working → On Break → Completed`.
- On punch out, compute `working_hours`, `break_minutes`, late minutes, and
  overtime **in a Postgres function or trigger** — not in the browser. Client
  clocks lie.
- Guard against double punch-in (unique constraint + upsert).

### Daily work log
Form fields: project, task, description, hours, status, attachment (Supabase
Storage), today's achievement, tomorrow's plan. Manager can review and comment.

### Marketing CRM
- Lead list with filters (status, priority, assignee, source) — all filters in the URL.
- Lead detail page with a vertical **activity timeline** built from
  `lead_activities`, newest first, showing time + activity + remarks.
- `next_followup` drives a "Follow-ups due today" widget and a notification.
- Kanban board view by status as a second view mode.

### Leave management
- Employee submits type / dates / reason / attachment.
- Approve or reject writes `approved_by` + inserts a notification for the employee.
- Overlap validation against existing approved leaves.

### Notifications
Realtime via Supabase Realtime on `notifications`. Bell icon with unread count,
dropdown, mark-as-read, and a full page. Triggers: task assigned, leave approved
or rejected, follow-up due, punch-out reminder, announcement published.

### Analytics (super admin)
Recharts: attendance %, late arrivals, working hours trend, lead conversion
funnel, daily leads, employee performance, leave statistics, productivity.
All queries aggregated in Postgres views or RPC — never fetch raw rows and reduce
in JS.

### Cross-cutting polish
Auto punch-out reminder · follow-up reminders · today's tasks widget · activity
feed · online status (Online / Working / On Break / Offline) · global command-K
search across employees, leads, tasks, work logs · dark mode · Excel + PDF export
on every report · dashboard metric cards · role-driven sidebar · audit trail on
every mutation · profile completion indicator.

---

## 6. Code standards (non-negotiable)

- Files under 400 lines, functions under 50. Split by feature, not by type:
  `src/features/attendance/{components,hooks,api,types}`.
- Never mutate — always return new objects.
- Every mutation goes through a typed API module in `features/*/api/`. No raw
  Supabase calls inside components.
- Generate types from the DB: `supabase gen types typescript`. No `any`.
- Every list has loading skeletons, empty states, and error states. No bare spinners.
- Every destructive action gets a confirm dialog.
- Validate on the client with zod **and** at the database with constraints/RLS.
- No secrets in source. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env
  only; ship a `.env.example`.
- Tests: unit tests for hour/late/overtime calculation and role permission logic,
  integration tests for RLS policies. Target 80% on business logic.

**Design:** this must not look like a default shadcn template. Pick a real visual
direction, define a token set (color, type scale, spacing rhythm, radii), and use
hierarchy and density deliberately. Data tables are the core surface — make them
excellent: sticky headers, column sorting, sensible row density, inline actions.

---

## 7. Build order

1. Vite + TS + Tailwind + shadcn scaffold, design tokens, layout shell
2. Supabase project, full schema migration, RLS policies, generated types
3. Auth: login, session persistence, AuthContext, ProtectedRoute, role sidebar
4. Profiles + employee management CRUD
5. Attendance (punch flow + DB-side calculations)
6. Work logs
7. Tasks
8. Leaves + approval flow
9. Marketing CRM (list, detail timeline, kanban)
10. Notifications + realtime
11. Announcements, audit logs, settings
12. Analytics + reports + exports
13. Global search, dark mode, polish pass
14. Deploy: Vercel + Supabase, env config, README with setup steps

Work through the list in order. After each phase: the app must build clean, types
must pass, and the feature must be usable end to end before moving on. Report what
you completed and what you deferred at each checkpoint — honestly, including
anything that doesn't work.

Start with phase 1.