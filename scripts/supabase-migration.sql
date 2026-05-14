-- Run this in Supabase Dashboard → SQL Editor

create table if not exists subscribers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade unique,
  email            text not null,
  stripe_customer_id    text,
  stripe_subscription_id text,
  plan             text not null default 'free',  -- 'free' | 'premium'
  plan_expires_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table subscribers enable row level security;

create policy "Users can read own row"
  on subscribers for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS automatically (no policy needed for service role key).
