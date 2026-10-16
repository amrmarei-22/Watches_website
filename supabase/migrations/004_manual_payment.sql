-- Manual payment workflow. Apply after 001_schema.sql, 002_functions.sql and 003_security.sql.

alter type public.order_status add value if not exists 'PENDING_VERIFICATION';
alter type public.order_status add value if not exists 'PAID';

alter table public.orders
  add column if not exists receipt_path text,
  add column if not exists receipt_url text,
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('COD', 'MANUAL'));

create or replace function public.place_manual_order(
  p_idempotency_key uuid,
  p_address_id uuid,
  p_receipt_path text,
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
end
$$;

create or replace function public.admin_transition_paid_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := private.require_admin();
  current_order public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if current_order.status <> 'PAID' then raise exception 'ORDER_STATUS_CHANGED'; end if;

  update public.orders set status = 'PROCESSING' where id = p_order_id;
  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
    values (p_order_id, 'PAID', 'PROCESSING', uid, 'ADMIN');
end
$$;

grant execute on function public.place_manual_order(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_confirm_manual_payment(uuid), public.admin_transition_paid_order(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

create policy receipts_read_all on storage.objects
  for select
  using (bucket_id = 'receipts');

create policy receipts_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and name like auth.uid()::text || '/%');

create policy receipts_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (name like auth.uid()::text || '/%' or public.is_admin()));
