-- Migration 005: Add receipt_url and ensure storage public read & cancellation support

-- 1. Ensure receipt_url column exists in orders table
alter table public.orders
  add column if not exists receipt_url text;

-- 2. Backfill existing orders where receipt_url is null and receipt_path is set
update public.orders
  set receipt_url = receipt_path
  where receipt_url is null and receipt_path is not null;

-- 3. Configure receipts bucket to allow public read access
update storage.buckets
  set public = true
  where id = 'receipts';

-- 4. Allow public read on receipts bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'receipts_public_read'
  ) then
    create policy receipts_public_read on storage.objects
      for select
      using (bucket_id = 'receipts');
  end if;
end $$;

-- 5. Allow admin order cancellation from PENDING_VERIFICATION state
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

-- 6. Update place_manual_order to accept p_receipt_url and populate both receipt_path and receipt_url
drop function if exists public.place_manual_order(uuid, uuid, text);

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
begin
  if p_receipt_path is null or p_receipt_path = '' then
    raise exception 'RECEIPT_REQUIRED';
  end if;

  v_receipt_url := coalesce(p_receipt_url, p_receipt_path);

  result := public.place_order(p_idempotency_key, p_address_id, 'COD');
  if coalesce((result->>'duplicate')::boolean, false) then
    return result;
  end if;
  order_id := (result->>'order_id')::uuid;

  update public.orders
    set payment_method = 'MANUAL',
        receipt_path = p_receipt_path,
        receipt_url = v_receipt_url,
        status = 'PENDING_VERIFICATION'
    where id = order_id and status = 'PENDING';

  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
    select order_id, 'PENDING', 'PENDING_VERIFICATION', user_id, 'CUSTOMER'
    from public.orders where id = order_id;

  return result;
end
$$;

grant execute on function public.place_manual_order(uuid, uuid, text, text) to authenticated;
