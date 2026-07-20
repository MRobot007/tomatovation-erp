-- ============================================================================
-- 0018 · New notification type for task status changes
-- ============================================================================
-- Deliberately alone in its own migration.
--
-- ALTER TYPE ... ADD VALUE commits the new label, but Postgres will not let
-- that label be USED until the transaction that added it has committed. A
-- migration that adds the value and then creates a trigger referencing it fails
-- with "unsafe use of new value of enum type". Splitting the two is the fix.

alter type public.notification_type add value if not exists 'task_status_changed';
