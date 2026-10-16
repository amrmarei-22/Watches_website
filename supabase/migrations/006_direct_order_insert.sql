-- ==============================================================================
-- Migration 006: Enable Direct Standard .insert() on orders and order_lines
-- Description: Allows authenticated users to insert orders directly using Supabase
-- client without relying on custom RPC functions.
-- ==============================================================================

-- 1. Ensure receipt_url column exists and payment_method allows MANUAL
alter table public.orders
  add column if not exists receipt_url text,
  add column if not exists receipt_path text;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('COD', 'MANUAL'));

-- 2. Grant INSERT privileges on orders, order_lines, order_status_history, and DELETE on cart_items
grant insert on public.orders to authenticated;
grant insert on public.order_lines to authenticated;
grant insert on public.order_status_history to authenticated;
grant delete on public.cart_items to authenticated;

-- 3. RLS Policies for Direct Insert
do $$
begin
  -- Policy for orders insert
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_insert'
  ) then
    create policy orders_insert on public.orders
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  -- Policy for order_lines insert
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'order_lines' and policyname = 'lines_insert'
  ) then
    create policy lines_insert on public.order_lines
      for insert to authenticated
      with check (exists (
        select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
      ));
  end if;

  -- Policy for order_status_history insert
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'order_status_history' and policyname = 'osh_insert'
  ) then
    create policy osh_insert on public.order_status_history
      for insert to authenticated
      with check (exists (
        select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
      ));
  end if;

  -- Policy for cart_items delete
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_delete'
  ) then
    create policy cart_delete on public.cart_items
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
