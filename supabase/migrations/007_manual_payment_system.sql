-- Manual payment system (payment_status + private receipt review)
-- The existing order_status lifecycle remains authoritative.

alter table public.orders
  add column if not exists payment_status text not null default 'awaiting_payment',
  add column if not exists payment_proof_path text,
  add column if not exists payment_sender_info text,
  add column if not exists payment_rejection_reason text,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references auth.users(id),
  add column if not exists payment_upload_count int not null default 0,
  add column if not exists shipping_governorate text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('awaiting_payment','under_review','paid','rejected','refunded'));
  end if;
end $$;

update public.orders
set payment_status = case
  when payment_method = 'MANUAL' and status = 'PAID' then 'paid'
  when payment_method = 'MANUAL' and status = 'PENDING_VERIFICATION' then 'under_review'
  else 'awaiting_payment'
end,
payment_proof_path = coalesce(payment_proof_path, receipt_path),
payment_upload_count = case when coalesce(payment_proof_path, receipt_path) is not null then 1 else 0 end,
shipping_governorate = coalesce(shipping_governorate, address_snapshot->>'governorate');

update public.orders set receipt_url = null where receipt_url is not null;

update storage.buckets set public = false where id = 'receipts';
drop policy if exists receipts_public_read on storage.objects;

-- Revoke broad direct writes introduced by migration 006.
revoke insert on public.orders, public.order_lines, public.order_status_history from authenticated;
revoke delete on public.cart_items from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_proofs_insert_own on storage.objects;
drop policy if exists payment_proofs_update_own on storage.objects;
drop policy if exists payment_proofs_delete_own on storage.objects;
drop policy if exists payment_proofs_select_own on storage.objects;
drop policy if exists payment_proofs_select_admin on storage.objects;

create policy payment_proofs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.orders o
      where o.user_id = auth.uid()
        and o.payment_method = 'MANUAL'
    )
  );

create policy payment_proofs_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.orders o
      where o.user_id = auth.uid()
        and o.payment_status in ('awaiting_payment','rejected')
    )
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.orders o where o.user_id = auth.uid()
    )
  );

create policy payment_proofs_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.orders o
      where o.user_id = auth.uid()
        and o.payment_status in ('awaiting_payment','rejected')
    )
  );

create policy payment_proofs_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (
      select o.id::text from public.orders o where o.user_id = auth.uid()
    )
  );

create policy payment_proofs_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_admin());

create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_proof_path text,
  p_sender_info text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := private.require_active_user();
  o public.orders%rowtype;
  old_path text;
begin
  select * into o from public.orders where id = p_order_id and user_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_method <> 'MANUAL' then raise exception 'ORDER_ILLEGAL_TRANSITION'; end if;
  if o.status = 'CANCELLED' or o.status = 'PAID' or o.status = 'DELIVERED'
  then raise exception 'ORDER_ILLEGAL_TRANSITION'; end if;
  if o.payment_status not in ('awaiting_payment','rejected') then
    raise exception 'PAYMENT_ALREADY_SUBMITTED';
  end if;
  if o.payment_upload_count >= 5 then raise exception 'PAYMENT_UPLOAD_LIMIT'; end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> p_order_id::text
  then raise exception 'INVALID_RECEIPT_PATH'; end if;

  old_path := o.payment_proof_path;
  update public.orders
  set payment_proof_path = p_proof_path,
      payment_sender_info = nullif(trim(p_sender_info), ''),
      payment_status = 'under_review',
      payment_rejection_reason = null,
      payment_submitted_at = now(),
      payment_upload_count = payment_upload_count + 1,
      status = 'PENDING_VERIFICATION'
  where id = p_order_id;

  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
  values (p_order_id,
          o.status,
          'PENDING_VERIFICATION',
          uid,
          'CUSTOMER');
end $$;

create or replace function public.admin_confirm_manual_payment(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := private.require_admin();
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_status <> 'under_review' or o.payment_proof_path is null
  then raise exception 'ORDER_ILLEGAL_TRANSITION'; end if;

  update public.orders
  set payment_status = 'paid',
      payment_verified_at = now(),
      payment_verified_by = uid,
      payment_rejection_reason = null,
      status = 'PAID'
  where id = p_order_id and payment_status = 'under_review';
  if not found then raise exception 'ORDER_STATUS_CHANGED'; end if;

  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
  values (p_order_id, o.status, 'PAID', uid, 'ADMIN');
  insert into public.audit_log(actor_id, action, entity, entity_id, meta)
  values (uid, 'ORDER_PAYMENT_CONFIRMED', 'order', p_order_id,
          jsonb_build_object('payment_status','paid'));
end $$;

create or replace function public.admin_reject_manual_payment(
  p_order_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := private.require_admin();
  o public.orders%rowtype;
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'REASON_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_status <> 'under_review' or o.payment_proof_path is null
  then raise exception 'ORDER_ILLEGAL_TRANSITION'; end if;

  update public.orders
  set payment_status = 'rejected',
      payment_rejection_reason = trim(p_reason),
      payment_verified_at = null,
      payment_verified_by = null
  where id = p_order_id and payment_status = 'under_review';
  if not found then raise exception 'ORDER_STATUS_CHANGED'; end if;

  insert into public.audit_log(actor_id, action, entity, entity_id, meta)
  values (uid, 'ORDER_PAYMENT_REJECTED', 'order', p_order_id,
          jsonb_build_object('payment_status','rejected','reason',trim(p_reason)));
end $$;

-- Standardize future standard order numbers to ORD.
create or replace function public.place_order(
  p_idempotency_key uuid,
  p_address_id uuid,
  p_payment_method text default 'COD'
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := private.require_active_user();
  st app_settings%rowtype; ex orders%rowtype; addr addresses%rowtype; prof profiles%rowtype;
  v_email text; v_confirmed timestamptz;
  conflicts jsonb := '[]'::jsonb; changed jsonb := '[]'::jsonb;
  r record; cnt int := 0; subtotal int := 0; total int; v_day date; v_n int; v_number text;
  v_order_id uuid; v_after int;
begin
  if p_payment_method not in ('COD','MANUAL') then raise exception 'PAYMENT_METHOD_UNSUPPORTED'; end if;
  select * into ex from orders where user_id = uid and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('order_id', ex.id, 'order_number', ex.order_number, 'duplicate', true); end if;
  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = uid;
  if v_confirmed is null then raise exception 'AUTH_VERIFY_REQUIRED'; end if;
  select * into addr from addresses where id = p_address_id and user_id = uid;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  select * into prof from profiles where id = uid;
  select * into st from app_settings where id = 1;
  for r in
    select ci.product_id, ci.quantity, ci.price_seen, p.name_ar, p.name_en, p.price, p.stock, p.status
    from cart_items ci join products p on p.id = ci.product_id
    where ci.user_id = uid order by p.id for update of p
  loop
    cnt := cnt + 1;
    if r.status <> 'ACTIVE' or r.stock < r.quantity or r.quantity > st.max_qty_per_line then
      conflicts := conflicts || jsonb_build_object('product_id', r.product_id, 'name_ar', r.name_ar, 'name_en', r.name_en,
        'requested', r.quantity, 'available', case when r.status = 'ACTIVE' then least(r.stock, st.max_qty_per_line) else 0 end);
    elsif r.price_seen <> r.price then
      changed := changed || jsonb_build_object('product_id', r.product_id, 'name_ar', r.name_ar, 'name_en', r.name_en);
    end if;
    subtotal := subtotal + r.price * r.quantity;
  end loop;
  if cnt = 0 then raise exception 'CART_EMPTY'; end if;
  if jsonb_array_length(conflicts) > 0 then raise exception 'CHECKOUT_STOCK_CONFLICT' using detail = conflicts::text; end if;
  if jsonb_array_length(changed) > 0 then raise exception 'CART_PRICE_CHANGED' using detail = changed::text; end if;
  total := subtotal + st.shipping_flat_fee;
  v_day := (now() at time zone 'Africa/Cairo')::date;
  insert into order_counters(day, last_value) values (v_day, 1)
    on conflict (day) do update set last_value = order_counters.last_value + 1 returning last_value into v_n;
  v_number := 'ORD-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_n::text, 5, '0');
  begin
    insert into orders(order_number, user_id, status, subtotal, shipping_fee, total, payment_method,
                       customer_name, customer_email, address_snapshot, shipping_governorate,
                       payment_status, idempotency_key)
    values (v_number, uid, 'PENDING', subtotal, st.shipping_flat_fee, total, p_payment_method,
            prof.name, coalesce(v_email, ''),
            to_jsonb(addr) - 'user_id' - 'id' - 'created_at' - 'is_default',
            addr.governorate,
            case when p_payment_method = 'MANUAL' then 'awaiting_payment' else 'awaiting_payment' end,
            p_idempotency_key)
    returning id into v_order_id;
  exception when unique_violation then
    select * into ex from orders where user_id = uid and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', ex.id, 'order_number', ex.order_number, 'duplicate', true);
  end;
  insert into order_lines(order_id, product_id, sku_snapshot, name_ar_snapshot, name_en_snapshot, unit_price_snapshot, quantity, line_total)
    select v_order_id, p.id, p.sku, p.name_ar, p.name_en, p.price, ci.quantity, p.price * ci.quantity
    from cart_items ci join products p on p.id = ci.product_id where ci.user_id = uid;
  for r in select ci.product_id, ci.quantity from cart_items ci where ci.user_id = uid order by ci.product_id loop
    update products set stock = stock - r.quantity where id = r.product_id returning stock into v_after;
    insert into inventory_log(product_id, before_stock, after_stock, delta, reason_code, actor_id)
      values (r.product_id, v_after + r.quantity, v_after, -r.quantity, 'ORDER_PLACED', uid);
  end loop;
  insert into order_status_history(order_id, from_status, to_status, actor_id, actor_role)
  values (v_order_id, null, 'PENDING', uid, 'CUSTOMER');
  delete from cart_items where user_id = uid;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'duplicate', false);
end $$;

drop function if exists public.place_manual_order(uuid, uuid, text);
drop function if exists public.place_manual_order(uuid, uuid, text, text);

create or replace function public.place_manual_order(
  p_idempotency_key uuid,
  p_address_id uuid,
  p_receipt_path text default null,
  p_receipt_url text default null,
  p_sender_info text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result jsonb;
  order_id uuid;
begin
  result := public.place_order(p_idempotency_key, p_address_id, 'MANUAL');
  if coalesce((result->>'duplicate')::boolean, false) then return result; end if;
  order_id := (result->>'order_id')::uuid;
  if p_receipt_path is not null then
    perform public.submit_payment_proof(order_id, p_receipt_path, p_sender_info);
  end if;
  return result;
end $$;

grant execute on function public.submit_payment_proof(uuid,text,text),
  public.admin_reject_manual_payment(uuid,text),
  public.place_manual_order(uuid,uuid,text,text,text),
  public.place_order(uuid,uuid,text) to authenticated;
