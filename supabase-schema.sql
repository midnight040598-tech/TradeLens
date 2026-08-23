-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query)

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  instrument text,
  direction text,
  entry numeric,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  support numeric,
  resistance numeric,
  trend text,
  bias text,
  pips numeric,
  rr numeric,
  thumb text,
  created_at timestamptz default now()
);

alter table trades enable row level security;

create policy "Users can view own trades"
  on trades for select
  using (auth.uid() = user_id);

create policy "Users can insert own trades"
  on trades for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own trades"
  on trades for delete
  using (auth.uid() = user_id);
