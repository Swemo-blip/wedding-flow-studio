-- Wedding Flow Studio — Supabase schema (free tier, no card).
-- Run this once in your Supabase project: SQL Editor → paste → Run.
--
-- Model: one row per wedding. The whole plan (wedding facts, guests, tables,
-- budget, checklist, timeline, music, speeches, vendors, studio layout) is held
-- as a single JSON blob — this mirrors how the app already stores things in
-- localStorage, so syncing is a straight lift. Sharing is handled by a members
-- table. Row-level security ensures people only see weddings they own or are
-- invited to.

create extension if not exists "pgcrypto";

-- One wedding plan per row.
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Our wedding',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who can access a wedding (the owner is implicit; this adds partners / family /
-- vendors). role: 'editor' (partner) or 'viewer' (family, vendor).
create table if not exists public.wedding_members (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (wedding_id, user_id)
);

alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;

-- Helper: is the current user allowed to see this wedding?
create or replace function public.can_access_wedding(wedding uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.weddings w where w.id = wedding and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.wedding_members m where m.wedding_id = wedding and m.user_id = auth.uid()
  );
$$;

-- weddings policies
create policy "owner or member can read" on public.weddings
  for select using (owner_id = auth.uid() or public.can_access_wedding(id));

create policy "owner can insert" on public.weddings
  for insert with check (owner_id = auth.uid());

create policy "owner or editor can update" on public.weddings
  for update using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.wedding_members m
      where m.wedding_id = id and m.user_id = auth.uid() and m.role = 'editor'
    )
  );

create policy "owner can delete" on public.weddings
  for delete using (owner_id = auth.uid());

-- members policies (only the wedding owner manages who is invited)
create policy "owner manages members" on public.wedding_members
  for all using (
    exists (select 1 from public.weddings w where w.id = wedding_id and w.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.weddings w where w.id = wedding_id and w.owner_id = auth.uid())
  );

create policy "members can read their membership" on public.wedding_members
  for select using (user_id = auth.uid());

-- Keep updated_at fresh on every change.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weddings_touch on public.weddings;
create trigger weddings_touch before update on public.weddings
  for each row execute function public.touch_updated_at();
