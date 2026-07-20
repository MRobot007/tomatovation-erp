# Tomatovation ERP

Internal ERP for employee management and marketing CRM — attendance, work logs,
tasks, leave, and a sales pipeline, for a company of 50–500 staff.

React 18 + TypeScript + Vite on the front, Supabase (Postgres, Auth, Row Level
Security, Realtime, Storage) on the back.

---

## Setup

### Prerequisites

- Node 20+ (developed on 22.12)
- A Supabase project
- Supabase CLI — no install needed, `npx supabase` works

### 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` from **Supabase Dashboard → Settings → API**:

| Variable | Where |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | **Publishable** key (`sb_publishable_…`) or legacy **anon** key |

Both are safe in the browser bundle — the publishable key is constrained by RLS.

> **Never** use the `service_role` / `sb_secret_` key here. It bypasses RLS
> entirely. `src/lib/env.ts` refuses to boot if it detects one, including a
> legacy `service_role` JWT (decoded from its role claim, not just
> pattern-matched).

### 2. Apply the schema

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push      # applies supabase/migrations/*
npm run db:types     # regenerates src/lib/database.types.ts
```

### 3. Turn off email confirmation (recommended for internal use)

**Authentication → Sign In / Providers → Email →** disable **Confirm email**.

Supabase's built-in mailer is rate-limited to a few messages an hour and often
lands in spam. For an internal tool where admins provision accounts, leave it
off. Turn it on (and configure custom SMTP) before exposing signup publicly.

### 4. Create the first super admin

`handle_new_user` hardcodes `role = 'employee'` and never reads the role from
signup metadata — that payload is attacker-controlled, and trusting it would
hand out `super_admin` to anyone who crafts a request. So the first admin has to
be promoted out-of-band.

Sign up in the app, then run this once in the **SQL Editor**:

```sql
update public.profiles
set role = 'super_admin'
where email = 'you@yourcompany.com';
```

There is also `public.bootstrap_first_super_admin('email')`, which only works
while zero super admins exist — self-disarming, and not exposed to the API.

```bash
npm run dev
```

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run typecheck` | Types only |
| `npm test` | Unit tests (hermetic — no network) |
| `npm run test:coverage` | Coverage against the 80% business-logic threshold |
| `npm run test:integration` | **Live** RLS + attendance tests against the linked project |
| `npm run test:rls` | RLS suite only |
| `npm run test:attendance` | Attendance calculation suite only |
| `npm run db:push` | Apply migrations |
| `npm run db:types` | Regenerate DB types |

`test:integration` creates real throwaway accounts (`*@example.com`). They are
plain employees, isolated by RLS, and safe to delete from **Authentication →
Users** at any time.

---

## Architecture

```
src/
├── components/
│   ├── ui/            Radix primitives restyled to the design tokens
│   └── layout/        app shell, sidebar, topbar, mobile nav
├── config/
│   └── navigation.ts  single source of truth for sidebar AND route guards
├── features/          one folder per domain: {api,hooks,components,schemas}
│   ├── admin/         announcements, audit logs, settings
│   ├── analytics/     chart theming, aggregate hooks
│   ├── attendance/    punch RPCs, presence, client context capture
│   ├── auth/          AuthContext, ProtectedRoute, auth screens
│   ├── employees/     roster, reporting lines
│   ├── leads/         CRM, timeline, kanban
│   ├── leaves/        requests, approval flow
│   ├── notifications/ realtime subscription, bell
│   ├── search/        command-K palette
│   ├── tasks/
│   └── work-logs/
├── hooks/             URL state, debounce
├── lib/               supabase client, query client, roles, env, export, utils
├── pages/             route-level screens
└── styles/            tokens.css (all colour) + index.css
```

### Rules this codebase holds itself to

- Server state lives in TanStack Query. URL state lives in search params. No
  Redux, no Zustand, no custom auth layer.
- Every mutation goes through a typed module in `features/*/api/`. Components
  never call Supabase directly.
- Files under 400 lines, functions under 50.
- Every list ships loading, empty and error states. No bare spinners.
- Every destructive action gets a confirm dialog.
- Validation happens twice: zod on the client, constraints + RLS in the database.
- No `any`. Types are generated from the live schema.

### Route guards can't drift from the sidebar

`app-routes.tsx` reads each route's allowed roles from the *same* `NAV_ITEMS`
array the sidebar renders from. A link cannot exist without a matching guard,
and adding a protected route with no nav entry throws at startup rather than
silently shipping an unguarded page.

---

## Design

**Warm Editorial.** Warm-neutral paper surfaces — every neutral carries a 36–42°
hue, so nothing reads blue-grey. Fraunces as the display cut against Inter for UI
text, a single tomato accent, and status carried by a soft tinted field *plus* a
dot, never colour alone.

Colour is authored in exactly one place:
[`src/styles/tokens.css`](src/styles/tokens.css). A living reference renders at
`/design-system`, in-app so it cannot drift from what production ships.

Both light and dark are designed, not inverted. Shadows are warm-tinted — a
neutral black shadow on warm paper reads muddy.

---

## Security model

**RLS is the boundary. Route guards are convenience.** Every table has RLS
enabled with explicit policies.

| Role | Sees |
|---|---|
| `employee` | Own rows, plus leads (marketing is collaborative) |
| `manager` | Own rows + anyone with `profiles.manager_id = auth.uid()` |
| `super_admin` | Everything; writes still audited |
| `audit_logs` | Insert for all, **select for super_admin only** |

Manager visibility resolves through `SECURITY DEFINER` helpers
(`public.can_access_employee` and friends). A policy on `profiles` that queries
`profiles` re-enters RLS and errors with infinite recursion (42P17); running that
one lookup as the definer breaks the cycle.

### Guards that exist because policies can't compare OLD to NEW

RLS policies see only the new row. These invariants therefore live in triggers:

- **No self-promotion** — the self-update policy would otherwise be a free path
  to `super_admin`.
- **No self-approved leave** — for *every* role, including super admin.
- **A reviewer can't rewrite the work log they're reviewing.**
- **An assignee can't reassign their own task** or rewrite the brief.
- **Only the read flag is editable on a notification.**
- **`audit_logs` has no UPDATE or DELETE policy for anyone.** A trail a super
  admin can rewrite is not evidence.

### `session_user`, not `current_user`

`acting_outside_postgrest()` distinguishes a direct database session from an API
request. It uses `session_user` because **inside a `SECURITY DEFINER` function,
`current_user` is the function owner** — an earlier version used `current_user`
and silently disabled every guard above. The RLS suite caught it by observing an
employee promote themselves. `anon` is deliberately not exempt.

### Attendance can't be forged

`punch_in` / `punch_out` / `toggle_break` are RPCs, not table writes. Timestamps
come from the database clock; hours, late minutes and overtime are computed by a
trigger. A client with a wrong or deliberately altered clock cannot manufacture a
working day. A unique `(employee_id, date)` constraint plus an idempotent upsert
means a double-tap returns the existing row.

---

## Testing

**161 tests** — 74 hermetic unit, 87 against the live database.

| Suite | Tests | What it proves |
|---|---|---|
| `roles.test.ts` | 18 | Role predicates; nav filtering; no empty groups |
| `env.test.ts` | 9 | Rejects `sb_secret_` and decoded `service_role` JWTs |
| `schemas.test.ts` | 15 | Trim-before-validate ordering on email and name |
| `export.test.ts` | 12 | RFC 4180 CSV quoting — commas, quotes, newlines |
| `storage.test.ts` | 20 | File size/MIME validation; key parsing |
| `rls.integration.test.ts` | 20 | **Live**: employee isolation across every table |
| `attendance.integration.test.ts` | 22 | **Live**: the real hour/late/overtime trigger |
| `manager-scoping.integration.test.ts` | 28 | **Live**: the reporting-line boundary, both directions |
| `storage.integration.test.ts` | 17 | **Live**: bucket policies and the owner-prefix convention |

The attendance suite exercises the actual Postgres trigger rather than a
TypeScript reimplementation, which would prove nothing about what runs. It
inserts rows with explicit historic timestamps, so a full working day verifies in
milliseconds without manipulating the clock.

The manager-scoping suite asserts every claim **twice** — that a manager *can*
reach their direct report, and *cannot* reach an unrelated employee. A policy
that accidentally returns everything passes the first half.

### Running the live suites

```bash
npm run test:fixtures       # once: creates three fixed @example.com accounts
```

Then link the reporting line (needs direct database access):

```bash
npx supabase db query --linked "update public.profiles set role = 'manager' where email = 'rls-fixture-manager@example.com'"
npx supabase db query --linked "update public.profiles set manager_id = (select id from public.profiles where email = 'rls-fixture-manager@example.com') where email = 'rls-fixture-report@example.com'"
```

```bash
npm run test:integration    # all three live suites
```

The manager suite offsets its dates by a per-run seed. The fixtures are
permanent accounts, so rows accumulate — and an approved leave cannot be deleted
by its owner (by policy), so the suite cannot clean up after itself. A fresh date
window per run sidesteps both. No assertion depends on the seed value.

---

## Deploying

### Frontend (Vercel)

```bash
vercel
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Project Settings →
Environment Variables**.

### What `vercel.json` does, and why

The file itself carries no comments — Vercel validates it against a strict
schema that rejects unknown properties, including a `comment` key. So the
reasoning lives here:

| Entry | Why |
|---|---|
| `rewrites` → `/index.html` | Without it a hard refresh on `/leads/<id>` 404s: no such file exists on disk. The `(?!api/)` guard keeps future API routes from being swallowed. |
| `Content-Security-Policy` | Scoped to Supabase (REST **and** `wss://` for Realtime) and Google Fonts. `style-src` needs `unsafe-inline` for Radix's inline positioning styles. |
| `Strict-Transport-Security` | Standard, with `preload`. |
| `Permissions-Policy` | `geolocation=(self)` is deliberate — the punch flow asks for it, and never blocks on the answer. Camera, mic and payment are denied outright. |
| `Cache-Control` on `/assets/*` | Filenames are content-hashed, so they can be immutable for a year. |
| `Cache-Control` on `/index.html` | Must **never** be cached: a stale `index.html` points at chunk filenames the next deploy deleted, and the app fails to load for anyone holding it. |

### Backend (Supabase)

```bash
npm run db:push
```

Add the Supabase project's URL to **Authentication → URL Configuration → Site
URL** and **Redirect URLs**, or password reset links will point at localhost.

### Scheduled reminders

Two RPCs exist but are not scheduled by default:

- `dispatch_followup_reminders()` — notifies owners of leads due today
- `dispatch_punch_out_reminders()` — notifies anyone clocked in past the cutoff

Both are idempotent, so running them repeatedly does not spam. Schedule with
`pg_cron`:

```sql
select cron.schedule('followups', '0 9 * * *', 'select public.dispatch_followup_reminders()');
select cron.schedule('punchout',  '0 * * * *', 'select public.dispatch_punch_out_reminders()');
```

---

## Attachments

Object keys are always `<user-id>/<filename>`, and that is **load-bearing
security, not a naming style**: the bucket policies compare
`(storage.foldername(name))[1]` to `auth.uid()`. A key without the owner prefix
is rejected on write and invisible on read. Paths are built by `ownedPath` in
`storage.api.ts` and never by a caller.

- **`avatars`** — public read, owner write, 2 MB, images only. Stored as a plain
  URL because an avatar appears in every roster row; signing each one would mean
  dozens of round trips per screen.
- **`attachments`** — private, 10 MB, images + PDF + Word + Excel. Stored as an
  object key, with a short-lived signed URL minted on click, so a link that
  escapes the app expires.

Uploads happen immediately, not on form submit. Deferring would mean uploading
during save, where a failure leaves the user looking at a saved record with a
silently missing file.

`storage.integration.test.ts` proves the boundary: a user cannot upload into a
colleague's folder or to the bucket root, a manager can read but not write or
delete a report's file, and the bucket rejects oversized or disallowed files
server-side even when the client check is bypassed.

## Known limitations

- **Kanban has no drag-and-drop.** Status changes go through the update path so
  the trigger writes a timeline entry; a drag that silently fails RLS is worse
  than an explicit control. Status is changed from the lead detail page.
- **Export is CSV, not xlsx.** A real xlsx writer costs ~400 kB of bundle for a
  feature used a few times a month, and Excel opens CSV natively (with a UTF-8
  BOM so accented names don't mojibake on Windows). PDF goes through the
  browser's print dialogue, which paginates better than a bundled library would.

  Lead *import* does read .xlsx, because you do not control what a colleague
  sends you. The reader (`read-excel-file`) is behind a dynamic import, so it is
  a 12 kB gzipped chunk fetched only when someone actually picks an .xlsx —
  nobody pays for it on page load. Only the first sheet of a workbook is read.
- **Global search filters client-side per table.** Fine at the spec's 500-employee
  ceiling; a `pg_trgm` index would be the next step.
