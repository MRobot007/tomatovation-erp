-- ============================================================================
-- 0023 · Notification type for an auto-closed day
-- ============================================================================
-- Its own migration because Postgres will not let a new enum value be USED in
-- the same transaction that adds it. The trigger that uses this lands in 0024.
--
-- Distinct from punch_out_reminder on purpose: a reminder asks the employee to
-- act, this tells them something was already done to their record. Reading
-- "Don't forget to punch out" when the system has already closed the day —
-- and possibly changed their hours — would be actively misleading.

alter type public.notification_type add value if not exists 'auto_punched_out';
