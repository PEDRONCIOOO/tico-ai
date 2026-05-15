-- Migration: AbacatePay subscription tables
--
-- Adds support for AbacatePay payments (PIX + Card):
--   1. profiles.abacatepay_customer_id — maps our user to AbacatePay's customer record,
--      so we don't recreate a customer on every checkout
--   2. webhook_events table — idempotency for AbacatePay webhooks. Primary key is the
--      event id from AbacatePay, so duplicate deliveries are no-ops
--
-- Apply this in Supabase SQL Editor against the live DB.

-- 1. Map our user to AbacatePay customer
alter table public.profiles
  add column if not exists abacatepay_customer_id text;

-- 1b. Pending plan — set by /api/checkout/create-subscription before redirecting
-- the user to the AbacatePay checkout, and consumed by the webhook when billing.paid
-- arrives (since the v1 webhook payload does NOT include product info, we need our
-- own breadcrumb to know whether this payment unlocks pro or unlimited).
alter table public.profiles
  add column if not exists pending_plan text check (pending_plan in ('pro', 'unlimited'));

-- 2. Webhook idempotency table
create table if not exists public.webhook_events (
  id text primary key,
  event text not null,
  received_at timestamptz default now(),
  payload jsonb
);

-- RLS: lock down — only the service role (used by our API routes) can read/write.
alter table public.webhook_events enable row level security;

-- No policies = no access for anon/authenticated. service_role bypasses RLS.
