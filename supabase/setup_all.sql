-- 001_schema.sql — tables, constraints, triggers. Source of truth: docs/TECH_STACK.md §3
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type product_status as enum ('DRAFT','ACTIVE','ARCHIVED');
create type order_status   as enum ('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED');
create type user_role      as enum ('CUSTOMER','ADMIN');

-- Constants (must equal src/config/businessConfig.ts; BUSINESS_RULES §0)
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  low_stock_threshold_default int not null default 3,
  max_qty_per_line int not null default 3,
  shipping_flat_fee int not null default 0,          -- minor units (piasters). Owner sets value.
  max_featured int not null default 8,
  max_addresses int not null default 5
);
insert into public.app_settings default values;

create function private.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- PROFILES -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '' check (phone = '' or phone ~ '^01[0125][0-9]{8}$'),
  role user_role not null default 'CUSTOMER',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'phone',''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- PRODUCTS ---------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Z0-9-]{3,30}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 120),
  name_en text not null check (char_length(name_en) between 2 and 120),
  brand text not null check (char_length(brand) between 1 and 60),
  description_ar text not null default '' check (char_length(description_ar) <= 5000),
  description_en text not null default '' check (char_length(description_en) <= 5000),
  price integer not null check (price > 0),                       -- minor units
  stock integer not null default 0 check (stock >= 0),
  low_stock_override integer check (low_stock_override is null or low_stock_override >= 0),
  status product_status not null default 'DRAFT',
  featured boolean not null default false,
  specs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_only_active check (not featured or status = 'ACTIVE')
);
create index products_status_idx on public.products(status);
create index products_brand_idx  on public.products(brand);
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,                      -- Storage path in bucket product-images, or a public asset path starting with '/'
  position int not null default 0,
  is_primary boolean not null default false
);
create unique index product_images_one_primary on public.product_images(product_id) where is_primary;
create index product_images_product_idx on public.product_images(product_id, position);

-- ADDRESSES ---------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  governorate text not null check (governorate = any (array[
    'Cairo','Giza','Alexandria','Dakahlia','Red Sea','Beheira','Fayoum','Gharbia','Ismailia','Menofia',
    'Minya','Qaliubiya','New Valley','Suez','Aswan','Assiut','Beni Suef','Port Said','Damietta','Sharkia',
    'South Sinai','Kafr El Sheikh','Matrouh','Luxor','Qena','North Sinai','Sohag'])),
  city text not null check (char_length(city) between 1 and 80),
  street text not null check (char_length(street) between 1 and 120),
  building text not null check (char_length(building) between 1 and 60),
  notes text check (notes is null or char_length(notes) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses(user_id) where is_default;

create function private.limit_addresses() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.addresses where user_id = new.user_id)
     >= (select max_addresses from public.app_settings where id = 1) then
    raise exception 'ADDRESS_LIMIT';
  end if;
  return new;
end $$;
create trigger addresses_limit before insert on public.addresses
  for each row execute function private.limit_addresses();

-- CART ---------------------------------------------------------------------
create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity >= 1),
  price_seen int not null,                 -- price the user last saw (BR 3.6)
  primary key (user_id, product_id)
);

-- ORDERS -------------------------------------------------------------------
create table public.order_counters (day date primary key, last_value int not null default 0);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id),
  status order_status not null default 'PENDING',
  subtotal int not null check (subtotal >= 0),
  shipping_fee int not null check (shipping_fee >= 0),
  total int not null check (total >= 0),
  payment_method text not null default 'COD' check (payment_method = 'COD'),
  customer_name text not null default '',
  customer_email text not null default '',
  address_snapshot jsonb not null,
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 50),
  cancel_reason text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,   -- BR 9.1
  sku_snapshot text not null,
  name_ar_snapshot text not null,
  name_en_snapshot text not null,
  unit_price_snapshot int not null,
  quantity int not null check (quantity >= 1),
  line_total int not null
);
create index order_lines_order_idx on public.order_lines(order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status order_status,
  to_status order_status not null,
  actor_id uuid,
  actor_role user_role,
  reason text,
  created_at timestamptz not null default now()
);
create index osh_order_idx on public.order_status_history(order_id, created_at);

create table public.order_admin_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  admin_id uuid not null default auth.uid(),
  note text not null check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- LOGS ----------------------------------------------------------------------
create table public.inventory_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  before_stock int not null,
  after_stock int not null,
  delta int not null,
  reason_code text not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_log_product_idx on public.inventory_log(product_id, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_idx on public.audit_log(created_at desc);

-- Triggers on products: initial stock log + audit + featured limit ---------------
create function private.products_after_insert() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into inventory_log(product_id, before_stock, after_stock, delta, reason_code, actor_id)
  values (new.id, 0, new.stock, new.stock, 'INITIAL', auth.uid());
  insert into audit_log(actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'PRODUCT_CREATED', 'product', new.id::text, jsonb_build_object('sku', new.sku));
  return new;
end $$;
create trigger products_ai after insert on public.products
  for each row execute function private.products_after_insert();

create function private.products_after_update() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into audit_log(actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'PRODUCT_UPDATED', 'product', new.id::text,
          jsonb_build_object('old', to_jsonb(old) - 'updated_at', 'new', to_jsonb(new) - 'updated_at'));
  return new;
end $$;
create trigger products_au after update on public.products
  for each row execute function private.products_after_update();
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
-- 003_security.sql — RLS, grants, storage. Principle: clients can NOT write stock, status, role, enabled, orders, cart (RPC only).
alter table public.app_settings        enable row level security;
alter table public.profiles            enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.addresses           enable row level security;
alter table public.cart_items          enable row level security;
alter table public.order_counters      enable row level security;
alter table public.orders              enable row level security;
alter table public.order_lines         enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_admin_notes   enable row level security;
alter table public.inventory_log       enable row level security;
alter table public.audit_log           enable row level security;

-- Start from zero privileges, then grant exactly what is needed
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.app_settings, public.products, public.product_images to anon, authenticated;
grant select on public.profiles, public.addresses, public.cart_items, public.orders, public.order_lines,
                public.order_status_history, public.order_admin_notes, public.inventory_log, public.audit_log to authenticated;

grant update (name, phone) on public.profiles to authenticated;
grant insert, update, delete on public.addresses to authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant insert (order_id, note) on public.order_admin_notes to authenticated;
-- products: editable columns only (no stock-after-create, status, featured, sku change)
grant insert (sku, name_ar, name_en, brand, description_ar, description_en, price, stock, low_stock_override, specs) on public.products to authenticated;
grant update (name_ar, name_en, brand, description_ar, description_en, price, low_stock_override, specs) on public.products to authenticated;
grant delete on public.products to authenticated;

-- policies
create policy settings_read on public.app_settings for select using (true);

create policy products_read   on public.products for select using (status = 'ACTIVE' or public.is_admin());
create policy products_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_delete on public.products for delete to authenticated using (public.is_admin() and status = 'DRAFT');

create policy images_read   on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id));
create policy images_write  on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy addresses_own on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_read     on public.cart_items for select to authenticated using (user_id = auth.uid());

create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lines_read  on public.order_lines for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy osh_read    on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy notes_read  on public.order_admin_notes for select to authenticated using (public.is_admin());
create policy notes_write on public.order_admin_notes for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());
create policy invlog_read on public.inventory_log for select to authenticated using (public.is_admin());
create policy audit_read  on public.audit_log for select to authenticated using (public.is_admin());

-- function execute grants
grant execute on function public.is_admin(), public.product_availability(int, int) to anon, authenticated;
grant execute on function
  public.cart_set_item(uuid, int), public.merge_guest_cart(jsonb), public.validate_cart(), public.set_default_address(uuid),
  public.place_order(uuid, uuid, text), public.cancel_my_order(uuid, text),
  public.admin_transition_order(uuid, order_status, order_status, text, text),
  public.admin_adjust_stock(uuid, text, int, text, text), public.admin_set_product_status(uuid, product_status),
  public.admin_set_featured(uuid, boolean), public.admin_set_user_enabled(uuid, boolean),
  public.admin_users(), public.admin_dashboard_counts()
to authenticated;

-- storage: public-read bucket, admin-only writes (5 MB, jpg/png/webp — BR 8.5)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy product_images_read   on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy product_images_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
