-- 002_functions.sql — the ONLY way to change protected data (stock, order status, roles, cart).
-- Errors are raised as `raise exception '<CODE>'` where CODE = i18n key / UI_STATES key. Frontend maps error.message → i18n.
-- Structured info (e.g. conflicts) is returned in the exception DETAIL as JSON text.

-- helpers -----------------------------------------------------------------------
create function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN' and enabled)
$$;

create function private.require_active_user() returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); en boolean;
begin
  if uid is null then raise exception 'AUTH_SESSION_EXPIRED'; end if;
  select enabled into en from public.profiles where id = uid;
  if en is distinct from true then raise exception 'AUTH_DISABLED'; end if;
  return uid;
end $$;

create function private.require_admin() returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return uid;
end $$;

-- Must match src/domain/inventory.ts getAvailability() (PRODUCT_STATES §3)
create function public.product_availability(p_stock int, p_override int) returns text language sql stable set search_path = public, pg_temp as $$
  select case
    when p_stock <= 0 then 'OUT_OF_STOCK'
    when p_stock <= coalesce(p_override, (select low_stock_threshold_default from app_settings where id = 1)) then 'LOW_STOCK'
    else 'IN_STOCK' end
$$;

-- cart ---------------------------------------------------------------------------
create function public.cart_set_item(p_product_id uuid, p_quantity int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user(); p products%rowtype; maxq int; q int;
begin
  if p_quantity is null or p_quantity <= 0 then
    delete from cart_items where user_id = uid and product_id = p_product_id;
    return jsonb_build_object('quantity', 0, 'removed', true, 'clamped', false);
  end if;
  select * into p from products where id = p_product_id;
  if not found or p.status <> 'ACTIVE' or p.stock <= 0 then raise exception 'CART_ITEM_UNAVAILABLE'; end if;
  select max_qty_per_line into maxq from app_settings where id = 1;
  q := least(p_quantity, p.stock, maxq);
  insert into cart_items(user_id, product_id, quantity, price_seen) values (uid, p_product_id, q, p.price)
    on conflict (user_id, product_id) do update set quantity = excluded.quantity, price_seen = excluded.price_seen;
  return jsonb_build_object('quantity', q, 'removed', false, 'clamped', q < p_quantity, 'max', least(p.stock, maxq));
end $$;

create function public.merge_guest_cart(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user(); e jsonb; pid uuid; gq int; existing int; p products%rowtype;
        maxq int; q int; changes jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then raise exception 'INVALID_INPUT'; end if;
  select max_qty_per_line into maxq from app_settings where id = 1;
  for e in select * from jsonb_array_elements(p_items) loop
    pid := (e->>'product_id')::uuid; gq := greatest(coalesce((e->>'quantity')::int, 0), 0);
    continue when gq = 0;
    select * into p from products where id = pid;
    if not found or p.status <> 'ACTIVE' or p.stock <= 0 then
      changes := changes || jsonb_build_object('code','CART_ITEM_UNAVAILABLE','product_id',pid,
        'name_ar', p.name_ar, 'name_en', p.name_en);
      continue;
    end if;
    select quantity into existing from cart_items where user_id = uid and product_id = pid;
    q := least(coalesce(existing,0) + gq, p.stock, maxq);
    if q < coalesce(existing,0) + gq then
      changes := changes || jsonb_build_object('code','CART_QTY_CLAMPED','product_id',pid,'n',q);
    end if;
    insert into cart_items(user_id, product_id, quantity, price_seen) values (uid, pid, q, p.price)
      on conflict (user_id, product_id) do update set quantity = excluded.quantity, price_seen = excluded.price_seen;
  end loop;
  return jsonb_build_object('changes', changes);
end $$;

create function public.validate_cart() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user(); r record; maxq int; changes jsonb := '[]'::jsonb;
begin
  select max_qty_per_line into maxq from app_settings where id = 1;
  for r in
    select ci.product_id, ci.quantity, ci.price_seen, p.name_ar, p.name_en, p.price, p.stock, p.status
    from cart_items ci join products p on p.id = ci.product_id where ci.user_id = uid order by p.id
  loop
    if r.status <> 'ACTIVE' or r.stock <= 0 then
      delete from cart_items where user_id = uid and product_id = r.product_id;
      changes := changes || jsonb_build_object('code','CART_ITEM_UNAVAILABLE','product_id',r.product_id,'name_ar',r.name_ar,'name_en',r.name_en);
    else
      if least(r.stock, maxq) < r.quantity then
        update cart_items set quantity = least(r.stock, maxq) where user_id = uid and product_id = r.product_id;
        changes := changes || jsonb_build_object('code','CART_QTY_CLAMPED','product_id',r.product_id,'n',least(r.stock, maxq));
      end if;
      if r.price_seen <> r.price then
        update cart_items set price_seen = r.price where user_id = uid and product_id = r.product_id;
        changes := changes || jsonb_build_object('code','CART_PRICE_CHANGED','product_id',r.product_id,'name_ar',r.name_ar,'name_en',r.name_en);
      end if;
    end if;
  end loop;
  return jsonb_build_object('changes', changes);
end $$;

-- addresses ----------------------------------------------------------------------
create function public.set_default_address(p_address_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user();
begin
  if not exists (select 1 from addresses where id = p_address_id and user_id = uid) then raise exception 'ADDRESS_NOT_FOUND'; end if;
  update addresses set is_default = false where user_id = uid and is_default;
  update addresses set is_default = true where id = p_address_id;
end $$;

-- orders ---------------------------------------------------------------------------
create function private.order_transition_allowed(p_from order_status, p_to order_status) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('PENDING','CONFIRMED'), ('PENDING','CANCELLED'),
    ('CONFIRMED','PROCESSING'), ('CONFIRMED','CANCELLED'),
    ('PROCESSING','SHIPPED'), ('PROCESSING','CANCELLED'),
    ('SHIPPED','DELIVERED'))
$$;

create function private.cancel_order_internal(p_order_id uuid, p_actor uuid, p_role user_role, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare o orders%rowtype; r record; v_after int;
begin
  select * into o from orders where id = p_order_id for update;
  update orders set status = 'CANCELLED', cancel_reason = p_reason where id = p_order_id;
  insert into order_status_history(order_id, from_status, to_status, actor_id, actor_role, reason)
    values (p_order_id, o.status, 'CANCELLED', p_actor, p_role, p_reason);
  for r in select product_id, quantity from order_lines where order_id = p_order_id order by product_id loop
    update products set stock = stock + r.quantity where id = r.product_id returning stock into v_after;
    insert into inventory_log(product_id, before_stock, after_stock, delta, reason_code, actor_id)
      values (r.product_id, v_after - r.quantity, v_after, r.quantity, 'ORDER_CANCELLED', p_actor);
  end loop;
end $$;

create function public.place_order(p_idempotency_key uuid, p_address_id uuid, p_payment_method text default 'COD') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := private.require_active_user();
  st app_settings%rowtype; ex orders%rowtype; addr addresses%rowtype; prof profiles%rowtype;
  v_email text; v_confirmed timestamptz;
  conflicts jsonb := '[]'::jsonb; changed jsonb := '[]'::jsonb;
  r record; cnt int := 0; subtotal int := 0; total int; v_day date; v_n int; v_number text; v_order_id uuid; v_after int;
begin
  if p_payment_method <> 'COD' then raise exception 'PAYMENT_METHOD_UNSUPPORTED'; end if;  -- BR 5.5
  select * into ex from orders where user_id = uid and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('order_id', ex.id, 'order_number', ex.order_number, 'duplicate', true); end if;  -- BR 5.6

  select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = uid;
  if v_confirmed is null then raise exception 'AUTH_VERIFY_REQUIRED'; end if;                                         -- BR 1.3
  select * into addr from addresses where id = p_address_id and user_id = uid;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  select * into prof from profiles where id = uid;
  select * into st from app_settings where id = 1;

  -- BR 5.1/5.2: lock product rows in a stable order (deadlock-safe), then validate
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
  if jsonb_array_length(changed)  > 0 then raise exception 'CART_PRICE_CHANGED'      using detail = changed::text;   end if;

  total := subtotal + st.shipping_flat_fee;
  v_day := (now() at time zone 'Africa/Cairo')::date;                                                                 -- BR 5.4
  insert into order_counters(day, last_value) values (v_day, 1)
    on conflict (day) do update set last_value = order_counters.last_value + 1 returning last_value into v_n;
  v_number := 'WS-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_n::text, 5, '0');

  begin
    insert into orders(order_number, user_id, status, subtotal, shipping_fee, total, payment_method,
                       customer_name, customer_email, address_snapshot, idempotency_key)
    values (v_number, uid, 'PENDING', subtotal, st.shipping_flat_fee, total, 'COD',
            prof.name, coalesce(v_email, ''), to_jsonb(addr) - 'user_id' - 'id' - 'created_at' - 'is_default', p_idempotency_key)
    returning id into v_order_id;
  exception when unique_violation then
    select * into ex from orders where user_id = uid and idempotency_key = p_idempotency_key;
    return jsonb_build_object('order_id', ex.id, 'order_number', ex.order_number, 'duplicate', true);
  end;

  insert into order_lines(order_id, product_id, sku_snapshot, name_ar_snapshot, name_en_snapshot, unit_price_snapshot, quantity, line_total)
    select v_order_id, p.id, p.sku, p.name_ar, p.name_en, p.price, ci.quantity, p.price * ci.quantity
    from cart_items ci join products p on p.id = ci.product_id where ci.user_id = uid;

  for r in select ci.product_id, ci.quantity from cart_items ci where ci.user_id = uid order by ci.product_id loop
    update products set stock = stock - r.quantity where id = r.product_id returning stock into v_after;   -- check(stock>=0) is the safety net
    insert into inventory_log(product_id, before_stock, after_stock, delta, reason_code, actor_id)
      values (r.product_id, v_after + r.quantity, v_after, -r.quantity, 'ORDER_PLACED', uid);
  end loop;

  insert into order_status_history(order_id, from_status, to_status, actor_id, actor_role) values (v_order_id, null, 'PENDING', uid, 'CUSTOMER');
  delete from cart_items where user_id = uid;
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'duplicate', false);
end $$;

create function public.cancel_my_order(p_order_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_active_user(); o orders%rowtype;
begin
  select * into o from orders where id = p_order_id and user_id = uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;                                       -- BR 2.1 (404)
  if o.status <> 'PENDING' then raise exception 'ORDER_CANCEL_TOO_LATE'; end if;               -- BR 5.9
  perform private.cancel_order_internal(p_order_id, uid, 'CUSTOMER', nullif(trim(p_reason), ''));
end $$;

create function public.admin_transition_order(p_order_id uuid, p_expected_from order_status, p_to order_status,
                                              p_reason text default null, p_tracking text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_admin(); o orders%rowtype;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> p_expected_from then raise exception 'ORDER_STATUS_CHANGED'; end if;                -- ORDER_STATES §4.3
  if not private.order_transition_allowed(o.status, p_to) then raise exception 'ORDER_ILLEGAL_TRANSITION'; end if;
  if p_to = 'CANCELLED' then
    if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
    perform private.cancel_order_internal(p_order_id, uid, 'ADMIN', trim(p_reason));
  else
    if p_to = 'SHIPPED' and p_tracking is not null and char_length(p_tracking) > 50 then raise exception 'INVALID_INPUT'; end if;
    update orders set status = p_to, tracking_number = case when p_to = 'SHIPPED' then nullif(trim(p_tracking), '') else tracking_number end
      where id = p_order_id;
    insert into order_status_history(order_id, from_status, to_status, actor_id, actor_role) values (p_order_id, o.status, p_to, uid, 'ADMIN');
  end if;
  insert into audit_log(actor_id, action, entity, entity_id, meta)
    values (uid, 'ORDER_STATUS_CHANGED', 'order', p_order_id::text, jsonb_build_object('from', o.status, 'to', p_to));
end $$;

-- inventory / products / users (admin) ---------------------------------------------
create function public.admin_adjust_stock(p_product_id uuid, p_mode text, p_value int, p_reason_code text, p_note text default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_admin(); p products%rowtype; v_new int;
begin
  if p_mode not in ('SET','ADJUST') or p_reason_code not in ('RESTOCK','CORRECTION','DAMAGED','OTHER') then raise exception 'INVALID_INPUT'; end if;
  select * into p from products where id = p_product_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_new := case when p_mode = 'SET' then p_value else p.stock + p_value end;
  if v_new < 0 then raise exception 'STOCK_NEGATIVE'; end if;                                       -- BR 4.2
  update products set stock = v_new where id = p_product_id;
  insert into inventory_log(product_id, before_stock, after_stock, delta, reason_code, note, actor_id)
    values (p_product_id, p.stock, v_new, v_new - p.stock, p_reason_code, p_note, uid);
  return v_new;
end $$;

create function public.admin_set_product_status(p_product_id uuid, p_to product_status) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_admin(); p products%rowtype;
begin
  select * into p from products where id = p_product_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if (p.status, p_to) not in (('DRAFT','ACTIVE'),('ARCHIVED','ACTIVE'),('ACTIVE','ARCHIVED'),('ACTIVE','DRAFT'),('ARCHIVED','DRAFT')) then
    raise exception 'ILLEGAL_PRODUCT_TRANSITION';
  end if;
  if p_to = 'ACTIVE' and not exists (select 1 from product_images where product_id = p_product_id) then   -- BR 8.6
    raise exception 'PRODUCT_NOT_PUBLISHABLE';
  end if;
  update products set status = p_to, featured = case when p_to = 'ACTIVE' then featured else false end where id = p_product_id;
  insert into audit_log(actor_id, action, entity, entity_id, meta)
    values (uid, 'PRODUCT_STATUS_CHANGED', 'product', p_product_id::text, jsonb_build_object('from', p.status, 'to', p_to));
end $$;

create function public.admin_set_featured(p_product_id uuid, p_featured boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_admin(); p products%rowtype;
begin
  perform pg_advisory_xact_lock(1001);
  select * into p from products where id = p_product_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_featured then
    if p.status <> 'ACTIVE' then raise exception 'PRODUCT_NOT_ACTIVE'; end if;
    if p.featured = false and (select count(*) from products where featured) >= (select max_featured from app_settings where id = 1) then
      raise exception 'FEATURED_LIMIT';                                                                  -- BR 8.7
    end if;
  end if;
  update products set featured = p_featured where id = p_product_id;
end $$;

create function public.admin_set_user_enabled(p_user_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := private.require_admin();
begin
  if p_user_id = uid then raise exception 'ADMIN_SELF_DISABLE'; end if;
  update profiles set enabled = p_enabled where id = p_user_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not p_enabled then delete from auth.sessions where user_id = p_user_id; end if;                    -- BR 9.3: log out immediately
  insert into audit_log(actor_id, action, entity, entity_id, meta)
    values (uid, case when p_enabled then 'USER_ENABLED' else 'USER_DISABLED' end, 'user', p_user_id::text, '{}'::jsonb);
end $$;

create function public.admin_users() returns table (id uuid, name text, email text, phone text, role user_role,
                                                   enabled boolean, email_confirmed boolean, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_admin();
  return query select p.id, p.name, u.email::text, p.phone, p.role, p.enabled, (u.email_confirmed_at is not null), p.created_at
               from profiles p join auth.users u on u.id = p.id order by p.created_at desc;
end $$;

create function public.admin_dashboard_counts() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'orders_by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from orders group by status) s), '{}'::jsonb),
    'low_stock',    (select count(*) from products where status = 'ACTIVE' and product_availability(stock, low_stock_override) = 'LOW_STOCK'),
    'out_of_stock', (select count(*) from products where status = 'ACTIVE' and product_availability(stock, low_stock_override) = 'OUT_OF_STOCK'));
end $$;
