-- Migration: RLS hardening
--
-- Fixes two security issues found during pentest audit:
--
--   1. CRITICAL — profiles UPDATE policy allows any authenticated user to set their
--      own tier to 'unlimited', bypassing payment. Fixed by adding a trigger that
--      blocks changes to sensitive columns unless the caller is service_role.
--
--   2. MEDIUM — check_usage() and increment_usage() RPCs accept any user_id,
--      allowing one user to read another's usage or consume their quota.
--      Fixed by validating auth.uid() = p_user_id inside each function.
--
-- Apply this in Supabase SQL Editor against the live DB.

-- ============================================================================
-- 1. Block tier escalation via profiles UPDATE
-- ============================================================================
--
-- The existing policy "Users can update own profile" allows updating any column.
-- We keep that policy (users need to update display_name, hotkey prefs, etc.)
-- but add a trigger that rejects changes to payment/tier columns from non-service roles.

create or replace function public.protect_sensitive_profile_fields()
returns trigger as $$
begin
  -- service_role bypasses RLS entirely so this trigger won't fire for it.
  -- But as defense-in-depth, also check explicitly.
  if current_setting('role') = 'service_role' then
    return new;
  end if;

  -- Block changes to payment/subscription columns
  if new.tier is distinct from old.tier then
    raise exception 'cannot modify tier';
  end if;
  if new.subscription_id is distinct from old.subscription_id then
    raise exception 'cannot modify subscription_id';
  end if;
  if new.subscription_status is distinct from old.subscription_status then
    raise exception 'cannot modify subscription_status';
  end if;
  if new.pending_plan is distinct from old.pending_plan then
    raise exception 'cannot modify pending_plan';
  end if;
  if new.current_period_end is distinct from old.current_period_end then
    raise exception 'cannot modify current_period_end';
  end if;
  if new.payment_provider is distinct from old.payment_provider then
    raise exception 'cannot modify payment_provider';
  end if;
  if new.abacatepay_customer_id is distinct from old.abacatepay_customer_id then
    raise exception 'cannot modify abacatepay_customer_id';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'cannot modify stripe_customer_id';
  end if;
  if new.email is distinct from old.email then
    raise exception 'cannot modify email';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_sensitive_profile_fields();

-- ============================================================================
-- 2. Validate caller in check_usage() and increment_usage()
-- ============================================================================

create or replace function public.check_usage(p_user_id uuid)
returns json as $$
declare
  v_tier text;
  v_usage_count int;
  v_limit int;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  -- Allow service_role (backend API proxy) to call for any user.
  -- Authenticated users can only check their own usage.
  if current_setting('role') != 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'access denied';
  end if;

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

create or replace function public.increment_usage(p_user_id uuid)
returns void as $$
declare
  v_tier text;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  -- Allow service_role (backend API proxy) to call for any user.
  -- Authenticated users can only increment their own usage.
  if current_setting('role') != 'service_role'
     and auth.uid() is distinct from p_user_id then
    raise exception 'access denied';
  end if;

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
