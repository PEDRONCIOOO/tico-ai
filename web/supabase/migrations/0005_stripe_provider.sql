-- Add Stripe support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Add provider and currency to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'abacatepay';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';
