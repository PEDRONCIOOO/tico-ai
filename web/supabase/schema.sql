-- Tico Database Schema

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  tier text not null default 'free' check (tier in ('free', 'pro', 'unlimited')),
  subscription_id text, -- AbacatePay billing ID or Stripe subscription ID
  subscription_status text default 'active',
  abacatepay_customer_id text,
  stripe_customer_id text,
  payment_provider text, -- 'abacatepay' | 'stripe'
  pending_plan text check (pending_plan in ('pro', 'unlimited')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Webhook idempotency: id is the event id from AbacatePay,
-- so duplicate deliveries are no-ops (insert .. on conflict do nothing).
create table public.webhook_events (
  id text primary key,
  event text not null,
  received_at timestamptz default now(),
  payload jsonb
);

alter table public.webhook_events enable row level security;
-- No policies — only service_role (bypasses RLS) can touch this table.

-- Usage tracking
create table public.usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  count int not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz default now(),
  unique (user_id, period_start)
);

-- Index for fast lookups by user + period
create index idx_usage_user_period on public.usage (user_id, period_start, period_end);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.usage enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can read their own usage
create policy "Users can read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to check and get usage for a user
create or replace function public.check_usage(p_user_id uuid)
returns json as $$
declare
  v_tier text;
  v_usage_count int;
  v_limit int;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  -- Get user tier
  select tier into v_tier from public.profiles where id = p_user_id;

  -- Set limits based on tier
  case v_tier
    when 'free' then
      v_limit := 10;
      v_period_start := date_trunc('day', now());
      v_period_end := date_trunc('day', now()) + interval '1 day';
    when 'pro' then
      v_limit := 500;
      v_period_start := date_trunc('month', now());
      v_period_end := date_trunc('month', now()) + interval '1 month';
    when 'unlimited' then
      v_limit := -1; -- unlimited
      v_period_start := date_trunc('month', now());
      v_period_end := date_trunc('month', now()) + interval '1 month';
  end case;

  -- Get or create usage record for current period
  select count into v_usage_count
  from public.usage
  where user_id = p_user_id
    and period_start = v_period_start;

  if v_usage_count is null then
    insert into public.usage (user_id, count, period_start, period_end)
    values (p_user_id, 0, v_period_start, v_period_end)
    on conflict (user_id, period_start) do nothing;
    v_usage_count := 0;
  end if;

  return json_build_object(
    'tier', v_tier,
    'used', v_usage_count,
    'limit', v_limit,
    'remaining', case when v_limit = -1 then -1 else v_limit - v_usage_count end,
    'allowed', case when v_limit = -1 then true else v_usage_count < v_limit end
  );
end;
$$ language plpgsql security definer;

-- Function to increment usage
create or replace function public.increment_usage(p_user_id uuid)
returns void as $$
declare
  v_tier text;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  select tier into v_tier from public.profiles where id = p_user_id;

  case v_tier
    when 'free' then
      v_period_start := date_trunc('day', now());
      v_period_end := date_trunc('day', now()) + interval '1 day';
    else
      v_period_start := date_trunc('month', now());
      v_period_end := date_trunc('month', now()) + interval '1 month';
  end case;

  -- Atomic upsert: insert with count=1, or increment existing count by 1
  insert into public.usage (user_id, count, period_start, period_end)
  values (p_user_id, 1, v_period_start, v_period_end)
  on conflict (user_id, period_start)
  do update set count = public.usage.count + 1;
end;
$$ language plpgsql security definer;
