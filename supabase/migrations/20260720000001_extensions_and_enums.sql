-- ============================================================================
-- 0001 · Extensions and enumerated types
-- ============================================================================
-- Enums rather than free-text status columns: the database rejects a typo
-- instead of silently creating a fourth lead status that no report knows about.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'manager', 'employee');
create type public.employee_status as enum ('active', 'inactive', 'suspended');

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
-- Mirrors the status machine in the spec: Not Started -> Working -> On Break
-- -> Completed. 'absent' and 'on_leave' are terminal states written by the
-- nightly reconciliation rather than by the punch flow.
create type public.attendance_status as enum (
  'not_started',
  'working',
  'on_break',
  'completed',
  'absent',
  'on_leave'
);

-- ---------------------------------------------------------------------------
-- Work logs and tasks
-- ---------------------------------------------------------------------------
create type public.work_log_status as enum ('draft', 'submitted', 'reviewed', 'needs_changes');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create type public.leave_type as enum ('casual', 'sick', 'earned', 'unpaid', 'comp_off', 'maternity', 'paternity');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- ---------------------------------------------------------------------------
-- Marketing CRM
-- ---------------------------------------------------------------------------
create type public.lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost'
);
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.lead_source as enum (
  'website',
  'referral',
  'cold_call',
  'email_campaign',
  'social',
  'event',
  'partner',
  'other'
);
create type public.lead_activity_kind as enum (
  'note',
  'call',
  'email',
  'meeting',
  'status_change',
  'assignment',
  'followup_scheduled'
);

-- ---------------------------------------------------------------------------
-- Notifications and audit
-- ---------------------------------------------------------------------------
create type public.notification_type as enum (
  'task_assigned',
  'leave_approved',
  'leave_rejected',
  'leave_requested',
  'followup_due',
  'punch_out_reminder',
  'announcement',
  'work_log_reviewed',
  'lead_assigned'
);

create type public.audit_action as enum ('insert', 'update', 'delete');
