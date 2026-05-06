create extension if not exists pgcrypto;

create table if not exists public.passnotfall_cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  access_token_hash text not null unique,
  customer_email text not null,
  status text not null default 'checkout_started',
  answers jsonb not null default '{}'::jsonb,
  billing_data jsonb not null default '{}'::jsonb,
  assessment jsonb,
  access_url text,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_invoice_url text,
  stripe_invoice_number text,
  stripe_error jsonb,
  confirmation_email_id text,
  confirmation_reference text,
  confirmation_sent_at timestamptz,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists passnotfall_cases_customer_email_idx on public.passnotfall_cases (customer_email);
create index if not exists passnotfall_cases_status_idx on public.passnotfall_cases (status);
create index if not exists passnotfall_cases_expires_at_idx on public.passnotfall_cases (expires_at);
create index if not exists passnotfall_cases_stripe_checkout_session_id_idx
  on public.passnotfall_cases (stripe_checkout_session_id);

alter table public.passnotfall_cases enable row level security;

drop policy if exists "No public access to passnotfall cases" on public.passnotfall_cases;
create policy "No public access to passnotfall cases"
  on public.passnotfall_cases
  for all
  using (false)
  with check (false);

create or replace function public.set_passnotfall_cases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_passnotfall_cases_updated_at on public.passnotfall_cases;
create trigger set_passnotfall_cases_updated_at
before update on public.passnotfall_cases
for each row
execute function public.set_passnotfall_cases_updated_at();

-- Optional cleanup job, if pg_cron is available in your Supabase project:
-- select cron.schedule(
--   'delete-expired-passnotfall-cases',
--   '15 3 * * *',
--   $$delete from public.passnotfall_cases where expires_at < now();$$
-- );
