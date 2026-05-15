-- Migration: feedback inbox
-- Users can leave messages. Pedro reads them in Supabase Studio (Table Editor).

create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete set null,
  email text not null,
  message text not null,
  created_at timestamptz default now()
);

create index idx_feedback_created on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Users can read their own feedback (optional, for showing "sent" state)
create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
