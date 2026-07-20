-- Market-qualification fields on leads.
--
-- Where a lead is, what it sells, and how big the opportunity is are the things
-- the pipeline is actually sorted by in practice. They were previously written
-- into remarks as free text, which cannot be filtered, counted or reported on.
--
-- All nullable: existing leads have none of this, and an import of a partial
-- spreadsheet must not be blocked because one column was missing.

alter table public.leads
  add column country        text check (country is null or length(btrim(country)) between 1 and 80),
  add column product_sector text check (product_sector is null or length(btrim(product_sector)) between 1 and 120),
  -- Stored as given rather than normalised to a canonical URL: people type
  -- "acme.in", and rewriting it to https://acme.in/ would misrepresent what
  -- they entered. The UI is responsible for making it clickable.
  add column website        text check (website is null or length(btrim(website)) between 1 and 255),
  add column scope          text check (scope is null or length(scope) <= 2000);

-- Country and sector are the two that get filtered on; the others are read on
-- the detail page only and do not earn an index.
create index leads_country_idx on public.leads (country) where country is not null;
create index leads_product_sector_idx on public.leads (product_sector) where product_sector is not null;

comment on column public.leads.country is 'Market the lead operates in.';
comment on column public.leads.product_sector is 'Industry or product category, e.g. "Food processing".';
comment on column public.leads.website is 'As entered — not normalised to a canonical URL.';
comment on column public.leads.scope is 'What the opportunity covers: sites, volumes, requirements.';
