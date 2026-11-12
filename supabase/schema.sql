-- Piece Plus private user data (run in a dedicated Supabase project).
-- No service_role credential is needed in the browser.
create table if not exists public.piece_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (length(item_id) between 1 and 160),
  item_type text not null check (item_type in ('note','progress')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, item_id)
);

create index if not exists piece_items_user_updated_idx
on public.piece_items (user_id, updated_at desc);

alter table public.piece_items enable row level security;
revoke all on public.piece_items from public, anon;
grant select, insert, update, delete on public.piece_items to authenticated;

create policy "Select own items" on public.piece_items
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own items" on public.piece_items
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own items" on public.piece_items
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Delete own items" on public.piece_items
for delete to authenticated using ((select auth.uid()) = user_id);

-- Notes are stored as JSONB so future note fields don't require schema changes.
-- The frontend maintains local offline copies. A tombstone (deleted_at) prevents
-- a note deleted on one device from being recreated during another-device sync.
