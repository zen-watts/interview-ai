create extension if not exists pgcrypto;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_spec text,
  created_at timestamptz not null default now()
);

alter table public.interviews enable row level security;

create policy "Users can read own interviews"
  on public.interviews
  for select
  using (auth.uid() = owner_id);

create policy "Users can insert own interviews"
  on public.interviews
  for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own interviews"
  on public.interviews
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete own interviews"
  on public.interviews
  for delete
  using (auth.uid() = owner_id);
