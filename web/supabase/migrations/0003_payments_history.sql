-- Migration: payments history + subscription period tracking

-- Track when the current billing period ends (for "próximo pagamento" display)
alter table public.profiles
  add column if not exists current_period_end timestamptz;

-- Payment history — one row per successful billing.paid webhook
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  billing_id text not null unique,
  amount int not null, -- centavos (4500 = R$45,00)
  plan text not null,
  paid_at timestamptz not null default now()
);

create index idx_payments_user on public.payments (user_id, paid_at desc);

alter table public.payments enable row level security;

-- Users can see their own payments
create policy "Users can read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Service role inserts (from webhook handler) — no insert policy needed,
-- service_role bypasses RLS.
