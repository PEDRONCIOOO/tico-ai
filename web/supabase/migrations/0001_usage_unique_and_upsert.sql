-- Migration: usage table unique constraint + RPC upsert fixes
--
-- Why:
--   1. The check_usage and increment_usage RPCs use ON CONFLICT (user_id, period_start)
--      but the original schema had no unique constraint on those columns, so the
--      ON CONFLICT clause would fail at runtime.
--   2. The original increment_usage RPC was an INSERT followed by an unconditional
--      UPDATE, which double-incremented on the first call (count became 2 instead of 1).
--      Replaced with a proper atomic upsert.
--
-- Apply this in Supabase SQL Editor against the live DB.

-- 1. Add the unique constraint that ON CONFLICT needs.
-- Use a unique index (more flexible than a constraint, lets us drop without affecting FKs).
create unique index if not exists usage_user_period_unique
  on public.usage (user_id, period_start);

-- 2. Replace increment_usage with a proper atomic upsert.
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

  insert into public.usage (user_id, count, period_start, period_end)
  values (p_user_id, 1, v_period_start, v_period_end)
  on conflict (user_id, period_start)
  do update set count = public.usage.count + 1;
end;
$$ language plpgsql security definer;

-- 3. Make check_usage's first-time insert idempotent under concurrency.
create or replace function public.check_usage(p_user_id uuid)
returns json as $$
declare
  v_tier text;
  v_usage_count int;
  v_limit int;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  select tier into v_tier from public.profiles where id = p_user_id;

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
      v_limit := -1;
      v_period_start := date_trunc('month', now());
      v_period_end := date_trunc('month', now()) + interval '1 month';
  end case;

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
