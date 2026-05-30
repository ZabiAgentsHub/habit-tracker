-- AI coaching messages table
create table if not exists public.coaching_messages (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  type       text        not null check (type in ('nudge','weekly_reflection','monthly_reflection')),
  content    text        not null,
  created_at timestamptz default now()
);

create index if not exists coaching_messages_user_created
  on public.coaching_messages(user_id, created_at desc);

alter table public.coaching_messages enable row level security;

-- Users can read their own messages (frontend queries)
create policy "users read own coaching"
  on public.coaching_messages for select
  using (auth.uid() = user_id);

-- Edge functions use the service role key which bypasses RLS for inserts
