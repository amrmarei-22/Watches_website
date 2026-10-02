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
