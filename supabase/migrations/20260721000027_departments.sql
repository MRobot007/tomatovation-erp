-- ============================================================================
-- 0027 · Departments as a real list, not whatever someone typed
-- ============================================================================
-- profiles.department is free text, and free text is how you end up with
-- "Marketing", "marketing", "Mktg" and "Markting" as four departments that no
-- filter can reconcile. The Add-employee form now picks from a list, so the
-- list needs somewhere to live.
--
-- Deriving the options from the profiles already saved cannot work: a
-- department has to exist BEFORE the first person can be put in it, and
-- "Marketing" and "Tech" have to exist before anyone at all. Hence a table.
--
-- profiles.department deliberately stays text rather than becoming a foreign
-- key. Making it a key would mean rewriting every filter, sort, export and
-- search that treats it as a string, for a table that will hold perhaps a dozen
-- rows. The table is the source of the OPTIONS; the column still stores the
-- answer.

create table public.departments (
  id         uuid primary key default extensions.gen_random_uuid(),
  -- citext: "Marketing" and "marketing" must collide. Two entries that look
  -- identical in a dropdown is exactly the mess this table exists to prevent.
  name       extensions.citext not null unique
             check (length(btrim(name::text)) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.departments is
  'The department options offered when assigning someone. profiles.department stores the chosen name as text.';

alter table public.departments enable row level security;

-- Readable by everyone signed in: the picker and the roster filter both need
-- it, and a department name is not sensitive.
create policy departments_select_all
  on public.departments for select
  to authenticated
  using (true);

-- Managers and super admins may add one. is_manager() is already true for both,
-- so it is the whole rule rather than an is_manager() or is_super_admin() pair
-- that reads as if they were different.
create policy departments_insert_manager
  on public.departments for insert
  to authenticated
  with check (public.is_manager());

-- No update or delete policy, so neither is possible. Renaming would silently
-- orphan every profile still holding the old string, and deleting would remove
-- an option people are already assigned to. Neither was asked for, and both
-- need a decision about what happens to the profiles pointing at them.

create index departments_name_idx on public.departments (name);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
-- The two requested defaults go in FIRST so their casing is the canonical one.
-- This database already contains both "tech" and "Tech"; whichever the backfill
-- happened to reach first would otherwise become the label everyone sees.
insert into public.departments (name)
values ('Marketing'), ('Tech')
on conflict (name) do nothing;

-- Then anything else already in use, so becoming a list loses nobody. Someone
-- currently in "Operations" must not find their department has vanished from
-- the picker the moment this ships. The unique index is on a citext column, so
-- case-variants of an existing name collapse into the row already there.
insert into public.departments (name)
select distinct btrim(department)
from public.profiles
where department is not null and btrim(department) <> ''
on conflict (name) do nothing;

-- Align the profiles with the list's casing.
--
-- "tech" and "Tech" are one department that two people typed differently, and
-- leaving them as distinct strings means the roster filter shows two entries
-- and each finds only some of the team. This rewrites the stored value to the
-- canonical spelling; it does not move anyone between departments, because the
-- match is case-insensitive.
-- lower(...) on both sides, not citext equality: see the note above the
-- self-check. The citext operators are not on the search_path in a migration,
-- so `d.name = btrim(p.department)::citext` compares case-SENSITIVELY and this
-- statement matches nothing at all — which is exactly what it did at first.
update public.profiles p
set department = d.name::text
from public.departments d
where p.department is not null
  and btrim(p.department) <> ''
  and lower(d.name::text) = lower(btrim(p.department))
  and p.department is distinct from d.name::text;

-- ---------------------------------------------------------------------------
-- Verify, rather than trust that the above did what it says
-- ---------------------------------------------------------------------------
-- Comparisons below are written with an explicit lower(...::text) rather than
-- relying on citext equality. The citext operators live in the `extensions`
-- schema, which is not on the search_path here, so `name in ('Tech')` silently
-- falls back to text equality and compares CASE-SENSITIVELY — which is how the
-- first version of this check reported "found 1 of 2" against a database that
-- had both rows. The column's unique index is unaffected: its operator class is
-- bound at creation, so dedup really is case-insensitive.
do $$
declare
  seeded    int;
  orphaned  int;
  mismatched int;
begin
  select count(*) into seeded from public.departments
  where lower(name::text) in ('marketing', 'tech');

  if seeded <> 2 then
    raise exception 'Migration 0027 self-check failed: expected Marketing and Tech, found % of 2', seeded;
  end if;

  -- Every department already in use must have made it into the list, or the
  -- picker would quietly drop people's existing assignment.
  select count(*) into orphaned
  from (
    select distinct lower(btrim(department)) as name
    from public.profiles
    where department is not null and btrim(department) <> ''
  ) used
  where not exists (
    select 1 from public.departments d where lower(d.name::text) = used.name
  );

  if orphaned > 0 then
    raise exception 'Migration 0027 self-check failed: % department(s) in use are missing from the list', orphaned;
  end if;

  -- And every stored value now matches the list exactly, so the roster filter
  -- shows one entry per department rather than one per spelling.
  select count(*) into mismatched
  from public.profiles p
  where p.department is not null
    and btrim(p.department) <> ''
    and not exists (select 1 from public.departments d where d.name::text = p.department);

  if mismatched > 0 then
    raise exception 'Migration 0027 self-check failed: % profile(s) hold a department spelled differently from the list', mismatched;
  end if;
end;
$$;
