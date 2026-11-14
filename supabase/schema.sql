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
  created_at       timestamptz not null default now()
);

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
  created_at      timestamptz not null default now()
);

-- Migration for databases created before drafts existed (safe to run more than once):
alter table public.businesses add column if not exists published boolean not null default true;

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

-- ------------------------------------------------------------------------ RLS
alter table public.ambassadors          enable row level security;
alter table public.businesses           enable row level security;
alter table public.business_owners      enable row level security;
alter table public.service_certificates enable row level security;
alter table public.inquiries            enable row level security;

-- Public websites are readable by anyone.
drop policy if exists "public can read businesses" on public.businesses;
create policy "public can read businesses" on public.businesses for select using (published = true);

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
