-- MH Launchpad database schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Security model: the Next.js server talks to Supabase with the service-role key
-- (which bypasses RLS) and enforces ownership itself. RLS is enabled everywhere so
-- that the public anon key can only read what is meant to be public.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- ambassadors
create table if not exists public.ambassadors (
  id               uuid primary key,
  name             text not null,
  email            text not null,
  is_demo          boolean not null default false,
  badge_awarded_at timestamptz,
  languages        jsonb not null default '[]',    -- languages they can interview in (public)
  bio              text not null default '',       -- short public bio
  accepting        boolean not null default false, -- shown to businesses only when true
  passcode_hash    text,                           -- scrypt hash; lets them sign back in
  created_at       timestamptz not null default now()
);

-- Migration for databases created before ambassador profiles existed (safe to re-run):
alter table public.ambassadors add column if not exists languages     jsonb   not null default '[]';
alter table public.ambassadors add column if not exists bio           text    not null default '';
alter table public.ambassadors add column if not exists accepting     boolean not null default false;
alter table public.ambassadors add column if not exists passcode_hash text;

-- ----------------------------------------------------------------- businesses
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  content         jsonb not null,                 -- the generated site JSON
  alt_lang        jsonb not null,                 -- {"code":"hi","label":"Hindi"}
  photos          jsonb not null default '[]',
  avatar_url      text,
  ambassador_name text not null default '',
  is_demo         boolean not null default false,
  published       boolean not null default true,   -- false = private draft / hidden by owner
  listed          boolean not null default true,   -- false = public by link only, not shown on the homepage
  sort_order      integer,                         -- homepage position chosen by an organizer (1 = first); null = after those
  created_at      timestamptz not null default now()
);

-- Migration for databases created before drafts existed (safe to run more than once):
alter table public.businesses add column if not exists published boolean not null default true;
alter table public.businesses add column if not exists sort_order integer;
alter table public.businesses add column if not exists listed boolean not null default true;

-- Owner emails live in their own table so they are never exposed with the public site.
create table if not exists public.business_owners (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  primary key (business_id, email)
);

-- --------------------------------------------------------- service_certificates
create table if not exists public.service_certificates (
  id            uuid primary key default gen_random_uuid(),
  ambassador_id uuid references public.ambassadors(id) on delete set null,
  student_name  text not null,                    -- "First L." only
  business_id   uuid references public.businesses(id) on delete set null,
  business_name text not null,
  business_slug text not null,
  hours         numeric not null default 2,
  status        text not null default 'pending_advisor_confirmation',
  issued_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------ inquiries
create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  contact     text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists inquiries_business_idx on public.inquiries (business_id, created_at desc);

-- ---------------------------------------------------------------- organizers
-- Emails allowed to use /organizer (reorder the homepage, see unpublished sites). Server-only table.
create table if not exists public.organizers (
  email text primary key
);
alter table public.organizers enable row level security;
-- Add yourself:  insert into public.organizers (email) values ('you@example.com') on conflict do nothing;

-- ---------------------------------------------------------- interview_requests
-- A business owner asks one specific ambassador to interview them.
create table if not exists public.interview_requests (
  id              uuid primary key default gen_random_uuid(),
  ambassador_id   uuid not null references public.ambassadors(id) on delete cascade,
  ambassador_name text not null default '',
  owner_email     text not null,                   -- private: never sent to the ambassador
  business_name   text not null,
  owner_language  text not null default 'en',
  note            text not null default '',
  contact         text not null default '',        -- shared only with the chosen ambassador
  status          text not null default 'pending', -- pending | accepted | declined | completed
  business_slug   text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists requests_ambassador_idx on public.interview_requests (ambassador_id, created_at desc);
create index if not exists requests_owner_idx on public.interview_requests (owner_email, created_at desc);

-- ------------------------------------------------------------------------ RLS
alter table public.ambassadors          enable row level security;
alter table public.businesses           enable row level security;
alter table public.business_owners      enable row level security;
alter table public.service_certificates enable row level security;
alter table public.inquiries            enable row level security;
-- interview_requests has RLS on and no policies on purpose: only the server (service role) can read it.
alter table public.interview_requests   enable row level security;

-- Public websites are readable by anyone.
drop policy if exists "public can read businesses" on public.businesses;
-- Unlisted sites are not enumerable through the public API; the server (service role) still serves them by link.
create policy "public can read businesses" on public.businesses for select using (published = true and listed = true);

-- Certificates can be verified by anyone who has the (unguessable) id; they hold no email.
drop policy if exists "public can read certificates" on public.service_certificates;
create policy "public can read certificates" on public.service_certificates for select using (true);

-- Owners (signed in via Supabase magic link) may edit their own business directly.
drop policy if exists "owners can update their business" on public.businesses;
create policy "owners can update their business" on public.businesses for update
  using (exists (
    select 1 from public.business_owners o
    where o.business_id = businesses.id and lower(o.email) = lower(auth.jwt() ->> 'email')
  ));

-- Owners can read their own inquiries; nobody else can.
drop policy if exists "owners can read their inquiries" on public.inquiries;
create policy "owners can read their inquiries" on public.inquiries for select
  using (exists (
    select 1 from public.business_owners o
    where o.business_id = inquiries.business_id and lower(o.email) = lower(auth.jwt() ->> 'email')
  ));

-- Owners can see their own ownership row. ambassadors has no policy: server-only.
drop policy if exists "owners can read own ownership" on public.business_owners;
create policy "owners can read own ownership" on public.business_owners for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- -------------------------------------------------------------------- storage
-- Public bucket for product photos and profile pictures (uploads happen server-side).
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;
