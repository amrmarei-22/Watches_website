# API Contract (Supabase) — everything the frontend may call

The frontend talks ONLY to Supabase via `@supabase/supabase-js`. Do not invent tables, columns, RPCs or endpoints. Database files: `supabase/migrations/001–003` (finished and tested; do not edit).

## 1. Error protocol
Business errors arrive as `error.message = '<CODE>'`; structured data (when any) is JSON text in `error.details`.
Map CODE → `messages.<CODE>` in `docs/i18n/*.json`. Unknown code → `PAGE_500`. Special cases:
- `AUTH_SESSION_EXPIRED` → BUSINESS_RULES §1.7 flow. `AUTH_DISABLED` → sign out + message. `FORBIDDEN` → 403 page. `NOT_FOUND` → 404 page.
- `CART_EMPTY` (from `place_order`) → show `CART_EMPTY` empty state, not an error toast.
- `CHECKOUT_STOCK_CONFLICT` → details = `[{product_id,name_ar,name_en,requested,available}]` → go to Cart, highlight them.
- `CART_PRICE_CHANGED` (from `place_order`) → call `validate_cart()`, show changes, let the user re-confirm.
- Postgres unique violation on `products.sku` (code `23505`) → `PRODUCT_SKU_TAKEN`.
- Check-constraint violations (`23514`) → form-level `INVALID_INPUT`.

## 2. Reads (supabase `.from().select()`; RLS filters automatically)
| Table | Who can read | Notes |
|-------|--------------|-------|
| `products` (+ `product_images(*)`) | everyone: ACTIVE only · admin: all | Availability computed in the app by `getAvailability()`; never filter by raw stock numbers except "in stock only" = `stock > 0` |
| `app_settings` | everyone | constants |
| `profiles` | own row · admin all | |
| `addresses`, `cart_items` | own | cart select: `cart_items(*, products(*, product_images(*)))` |
| `orders`, `order_lines`, `order_status_history` | own · admin all | |
| `order_admin_notes`, `inventory_log`, `audit_log` | admin only | |

## 3. Direct writes allowed (RLS + column grants enforce)
| Who | Table | Allowed |
|-----|-------|---------|
| user | `profiles` | update `name`, `phone` only |
| user | `addresses` | insert / update / delete own (max 5; first default via RPC) |
| admin | `products` | insert (sku, names, brand, descriptions, price, stock, low_stock_override, specs) · update (same minus sku, stock) · delete only DRAFT |
| admin | `product_images` | insert / update / delete |
| admin | `order_admin_notes` | insert (order_id, note) |
| admin | Storage bucket `product-images` | upload/delete (jpg/png/webp ≤ 5 MB) |
Product edit conflict (ADMIN_FLOW A3): `update … where id = :id and updated_at = :loaded` → 0 rows ⇒ `ADMIN_EDIT_CONFLICT`.
Everything else is **RPC only**.

## 4. RPC functions (`supabase.rpc(name, params)`)
| RPC | Params | Returns | Errors |
|-----|--------|---------|--------|
| `cart_set_item` | `p_product_id`, `p_quantity` (absolute; 0 = remove) | `{quantity, removed, clamped, max}` | `CART_ITEM_UNAVAILABLE` |
| `merge_guest_cart` | `p_items: [{product_id, quantity}]` (≤50) | `{changes:[{code,…}]}` | `INVALID_INPUT` |
| `validate_cart` | — | `{changes:[{code,product_id,name_ar,name_en,n?}]}` codes: `CART_ITEM_UNAVAILABLE`, `CART_QTY_CLAMPED`, `CART_PRICE_CHANGED` | |
| `set_default_address` | `p_address_id` | void | `ADDRESS_NOT_FOUND` |
| `place_order` | `p_idempotency_key` (uuid), `p_address_id`, `p_payment_method='COD'` | `{order_id, order_number, duplicate}` | `AUTH_VERIFY_REQUIRED`, `CART_EMPTY`, `CHECKOUT_STOCK_CONFLICT`, `CART_PRICE_CHANGED`, `ADDRESS_NOT_FOUND`, `PAYMENT_METHOD_UNSUPPORTED` |
| `cancel_my_order` | `p_order_id`, `p_reason?` | void | `NOT_FOUND`, `ORDER_CANCEL_TOO_LATE` |
| `admin_transition_order` | `p_order_id`, `p_expected_from`, `p_to`, `p_reason?`, `p_tracking?` | void | `ORDER_STATUS_CHANGED`, `ORDER_ILLEGAL_TRANSITION`, `REASON_REQUIRED`, `NOT_FOUND`, `FORBIDDEN` |
| `admin_adjust_stock` | `p_product_id`, `p_mode` (`SET`/`ADJUST`), `p_value`, `p_reason_code` (`RESTOCK`/`CORRECTION`/`DAMAGED`/`OTHER`), `p_note?` | new stock (int) | `STOCK_NEGATIVE`, `INVALID_INPUT` |
| `admin_set_product_status` | `p_product_id`, `p_to` | void | `ILLEGAL_PRODUCT_TRANSITION`, `PRODUCT_NOT_PUBLISHABLE` |
| `admin_set_featured` | `p_product_id`, `p_featured` | void | `PRODUCT_NOT_ACTIVE`, `FEATURED_LIMIT` |
| `admin_set_user_enabled` | `p_user_id`, `p_enabled` | void | `ADMIN_SELF_DISABLE`, `NOT_FOUND` |
| `admin_users` | — | rows (id, name, email, phone, role, enabled, email_confirmed, created_at) | `FORBIDDEN` |
| `admin_dashboard_counts` | — | `{orders_by_status, low_stock, out_of_stock}` | `FORBIDDEN` |
| `product_availability` | `p_stock`, `p_override` | text | (mirror of `getAvailability()`; tests must assert both agree) |

## 5. Auth
`supabase.auth.signUp({ email, password, options: { data: { name, phone }, emailRedirectTo } })` · `signInWithPassword` · `resetPasswordForEmail` · `updateUser({password})` · `signOut`. Profile row is created automatically by a DB trigger. Admin = `profiles.role = 'ADMIN'` (set manually, see `supabase/README.md`).
Email verified? → `session.user.email_confirmed_at != null`.

## 6. Checkout call order
`addresses.insert` (if new) → `validate_cart()` (show changes) → user confirms → `place_order(key, address_id)`; `key` = one `crypto.randomUUID()` generated when entering the Review step and reused for retries.
