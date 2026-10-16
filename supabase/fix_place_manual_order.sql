-- ==============================================================================
-- FIX: Supabase RPC Function `public.place_manual_order`
-- Description: Run this script directly in the Supabase Dashboard -> SQL Editor.
-- It creates/updates the `place_manual_order` function, ensures required columns,
-- constraints, enum values, storage bucket policies, and reloads PostgREST schema.
-- ==============================================================================

-- 1. Ensure required order status enum values exist
alter type public.order_status add value if not exists 'PENDING_VERIFICATION';
alter type public.order_status add value if not exists 'PAID';

-- 2. Ensure orders table has columns for receipt path & receipt URL
alter table public.orders
  add column if not exists receipt_path text,
  add column if not exists receipt_url text;

-- 3. Update payment_method constraint to allow 'MANUAL' alongside 'COD'
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('COD', 'MANUAL'));

-- 4. Ensure private transition rule permits cancellation and verification
create or replace function private.order_transition_allowed(p_from order_status, p_to order_status) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('PENDING','CONFIRMED'), ('PENDING','CANCELLED'),
    ('PENDING_VERIFICATION','PAID'), ('PENDING_VERIFICATION','CANCELLED'),
    ('PAID','PROCESSING'), ('PAID','CANCELLED'),
    ('CONFIRMED','PROCESSING'), ('CONFIRMED','CANCELLED'),
    ('PROCESSING','SHIPPED'), ('PROCESSING','CANCELLED'),
    ('SHIPPED','DELIVERED'))
$$;

-- 5. Drop any existing signatures to prevent parameter mismatch in PostgREST
drop function if exists public.place_manual_order(uuid, uuid, text);
drop function if exists public.place_manual_order(uuid, uuid, text, text);

-- 6. Create the main `place_manual_order` function
-- Supports callers passing (p_idempotency_key, p_address_id, p_receipt_path, p_receipt_url)
-- or (p_idempotency_key, p_address_id, p_receipt_path) with default null
create or replace function public.place_manual_order(
  p_idempotency_key uuid,
  p_address_id uuid,
  p_receipt_path text default null,
  p_receipt_url text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  result jsonb;
  order_id uuid;
  v_receipt_url text;
  v_receipt_path text;
begin
  -- Validate receipt is provided
  if (p_receipt_path is null or trim(p_receipt_path) = '') and (p_receipt_url is null or trim(p_receipt_url) = '') then
    raise exception 'RECEIPT_REQUIRED';
  end if;

  v_receipt_path := coalesce(nullif(trim(p_receipt_path), ''), p_receipt_url);
  v_receipt_url  := coalesce(nullif(trim(p_receipt_url), ''), p_receipt_path);

  -- Call underlying place_order to validate cart, inventory, idempotency, and create order
  result := public.place_order(p_idempotency_key, p_address_id, 'COD');
  if coalesce((result->>'duplicate')::boolean, false) then
    return result;
  end if;
  order_id := (result->>'order_id')::uuid;

  -- Update order with manual payment details and PENDING_VERIFICATION status
  update public.orders
    set payment_method = 'MANUAL',
        receipt_path = v_receipt_path,
        receipt_url = v_receipt_url,
        status = 'PENDING_VERIFICATION'
    where id = order_id and status = 'PENDING';

  -- Record status history
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
    select order_id, 'PENDING', 'PENDING_VERIFICATION', user_id, 'CUSTOMER'
    from public.orders where id = order_id;

  return result;
end;
$$;

-- 7. Grant execution privileges to authenticated users & service role
grant execute on function public.place_manual_order(uuid, uuid, text, text) to authenticated;
grant execute on function public.place_manual_order(uuid, uuid, text, text) to service_role;

-- 8. Ensure admin confirmation function exists
create or replace function public.admin_confirm_manual_payment(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := private.require_admin();
  current_order public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_order.status <> 'PENDING_VERIFICATION' or current_order.payment_method <> 'MANUAL' then
    raise exception 'ORDER_ILLEGAL_TRANSITION';
  end if;

  update public.orders set status = 'PAID' where id = p_order_id;
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
    values (p_order_id, 'PENDING_VERIFICATION', 'PAID', uid, 'ADMIN');
  insert into public.audit_log(actor_id, action, entity, entity_id, meta)
    values (uid, 'ORDER_PAYMENT_CONFIRMED', 'order', p_order_id, jsonb_build_object('to', 'PAID'));
end;
$$;

grant execute on function public.admin_confirm_manual_payment(uuid) to authenticated;

-- 9. Ensure receipts storage bucket exists and is public
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

-- Storage policies for receipts
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts_public_read'
  ) then
    create policy receipts_public_read on storage.objects for select using (bucket_id = 'receipts');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'receipts_insert_own'
  ) then
    create policy receipts_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'receipts' and name like auth.uid()::text || '/%');
  end if;
end $$;

-- 10. Force PostgREST to reload its schema cache immediately
notify pgrst, 'reload schema';
