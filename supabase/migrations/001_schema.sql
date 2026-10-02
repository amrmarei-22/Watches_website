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
