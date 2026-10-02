# Tech Stack & Architecture

Decided by the owner's delegation (owner has no backend; wants a hosted one). Changing any item requires owner approval.

## 1. Stack
| Layer | Choice |
|-------|--------|
| Frontend | Vite + React + TypeScript (strict) — already scaffolded |
| Routing | `react-router-dom` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) with design tokens from `DESIGN.md` as CSS variables |
| Accessible primitives | Radix UI primitives (dialog, select, toast, tabs…) |
| Backend (hosted) | **Supabase**: Postgres + Auth + Storage + Row Level Security + SQL functions (RPC) |
| Data fetching | `@supabase/supabase-js` + `@tanstack/react-query` |
| Forms & validation | `react-hook-form` + `zod` (shared schemas in `src/domain/schemas.ts`) |
| i18n | `i18next` + `react-i18next` |
| Animation | `motion` (UI micro-interactions, page/layout transitions), `gsap` + `@gsap/react` + ScrollTrigger (scroll storytelling), `lenis` (smooth scroll; optional, owner installs) |
| Tests | Vitest + Testing Library |
| Hosting | Frontend: Vercel / Netlify / Cloudflare Pages (owner chooses). Backend: Supabase cloud |

Already installed: `motion`, `framer-motion` (REMOVE it, use `motion` only), `gsap`, `@gsap/react`.
Copilot must NOT install anything else without asking (print the command, wait).

## 2. "Server is the authority" means Supabase
There is no custom server. Authority is enforced by **Row Level Security (RLS) policies + SQL functions (RPC)**.
- The browser only ever uses the **anon/publishable key** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The `service_role` key must NEVER appear in frontend code, `.env` committed to git, or logs.
- `.env.local` is git-ignored; provide `.env.example` with empty values.
- Clients can NOT directly write: `products.stock`, `orders.status`, `profiles.role`, `profiles.enabled`. These change only through RPC functions below.

## 3. Database (tables, compact — the real definition is `supabase/migrations/`, which wins over this summary)
Enums: `product_status(DRAFT,ACTIVE,ARCHIVED)`, `order_status(PENDING,CONFIRMED,PROCESSING,SHIPPED,DELIVERED,CANCELLED)`, `user_role(CUSTOMER,ADMIN)`.

- `profiles(id uuid pk → auth.users, name, phone, role user_role default 'CUSTOMER', enabled bool default true, created_at)`
- `products(id, sku unique, name_ar, name_en, brand, description_ar, description_en, price int, stock int check(stock>=0), low_stock_override int null, status product_status default 'DRAFT', featured bool, specs jsonb, created_at, updated_at)`
- `product_images(id, product_id, path, position int, is_primary bool)` (files in Storage bucket `product-images`)
- `addresses(id, user_id, full_name, phone, governorate, city, street, building, notes, is_default)` max 5 per user (trigger)
- `cart_items(user_id, product_id, quantity, unit_price_seen, primary key(user_id, product_id))` (no separate carts table)
- `orders(id, order_number unique, user_id, status, subtotal, shipping_fee, total, payment_method, address_snapshot jsonb, tracking_number null, idempotency_key uuid, created_at, updated_at, unique(user_id, idempotency_key))`
- `order_lines(id, order_id, product_id, sku_snapshot, name_ar_snapshot, name_en_snapshot, unit_price_snapshot, quantity, line_total)`
- `order_status_history(id, order_id, from_status, to_status, actor_id, actor_role, reason null, created_at)`
- `order_admin_notes(id, order_id, admin_id, note, created_at)` append-only
- `inventory_log(id, product_id, before, after, delta, reason_code, note, actor_id, created_at)`
- `audit_log(id, actor_id, action, entity, entity_id, meta jsonb, created_at)`
- (`login_attempts` for lockout is NOT created yet — see OPEN_DECISIONS #20)

## 4. RPC functions (full contract in `docs/API.md`; the only way to mutate protected data) — all `security definer`, check `auth.uid()` and role inside
| Function | Implements |
|----------|-----------|
| `is_admin()` | permissions helper for RLS |
| `cart_set_item(product_id, quantity)` | BR 3.3–3.4 (absolute quantity; 0 removes) |
| `merge_guest_cart(items jsonb)` | BR 3.2 — items = `[{product_id, quantity}]` |
| `set_default_address(address_id)` | BR 6.4 |
| `admin_set_featured(product_id, bool)` | BR 8.7 |
| `admin_users()`, `admin_dashboard_counts()` | ADMIN_FLOW A6 / A2 |
| `validate_cart()` | BR 3.6; returns the corrected cart + list of changes |
| `cart_set_item`, `cart_add_item` | BR 3.3–3.4 (clamp to min(stock, 3)) |
| `place_order(idempotency_key uuid, address_id uuid, payment_method text default 'COD')` | BR 5.1–5.6. One transaction: `SELECT … FOR UPDATE` on products, check, deduct, insert order/lines/history, clear cart. Raises `CHECKOUT_STOCK_CONFLICT` with affected items |
| `cancel_my_order(order_id, reason)` | BR 5.9 (PENDING only) + stock restore |
| `admin_transition_order(order_id, expected_from, to_status, reason, tracking)` | ORDER_STATES (validates the table; `expected_from` = optimistic check §4.3) |
| `admin_adjust_stock(product_id, mode, value, reason_code, note)` | BR 4.2–4.3, writes inventory_log |
| `admin_set_product_status(product_id, to_status)` | PRODUCT_STATES §2 incl. BR 8.6 checks |
| `admin_set_user_enabled(user_id, enabled)` | BR 9.3, ADMIN_SELF_DISABLE |
| `admin_delete_draft_product`, `admin_dashboard_stats` | BR 9.1, ADMIN_FLOW A2 |
The TypeScript state machine / inventory modules (`src/domain/*`) mirror these rules for UX; the DB functions are authoritative. A test must exist asserting both agree on the transition table.

## 5. RLS summary
- `products`: anon+customer SELECT only `status='ACTIVE'`; admin all. Writes: admin only (stock/status via RPC).
- `orders`, `order_lines`, `order_status_history`: customer SELECT own; admin SELECT all; no direct writes.
- `cart*`, `addresses`: owner only.
- `profiles`: user SELECT/UPDATE own `name, phone` only; admin SELECT all.
- `inventory_log`, `audit_log`, `order_admin_notes`: admin only.
- Unauthorized access to another user's order returns no row → UI shows 404 (BR 2.1).

## 6. Auth with Supabase
- Email + password, **email confirmation enabled**. Admin accounts: created by the owner in Supabase dashboard, then `profiles.role='ADMIN'` set via SQL (never via the app).
- Separate admin login page `/admin/login`; after login the app verifies `profiles.role='ADMIN'`, otherwise signs out and shows `AUTH_INVALID_CREDENTIALS`.
- Idle timeout / lockout: see OPEN_DECISIONS #20, #21. Until decided, implement a client-side idle timer using `SESSION_IDLE_TIMEOUT_MIN` and mark the TODO.

## 7. Source layout
```
src/
  app/            router, providers, layouts (StoreLayout, AdminLayout)
  config/         businessConfig.ts
  domain/         types.ts, inventory.ts, orderStateMachine.ts, permissions.ts, schemas.ts, money.ts
  lib/            supabaseClient.ts, queryClient.ts, i18n.ts
  features/       catalog/ product/ cart/ checkout/ orders/ account/ auth/ admin/
  components/     ui/ (Button, Input, Dialog, Toast, Skeleton, EmptyState, ErrorState…)
  motion/         shared animation presets + hooks (useReducedMotion, ScrollReveal…)
  locales/        en.json, ar.json   (copy from docs/i18n/)
  styles/         tokens.css, global.css
supabase/
  migrations/     SQL (tables, RLS, RPC) — one file per step, never edited after being applied
  seed.sql        sample products (flagged as SAMPLE)
```

## 8. Localization rules (Arabic + English)
- Languages: `ar` (default) and `en`. Direction: `ar` → `rtl`, `en` → `ltr`, set on `<html lang dir>`.
- URL prefix: `/ar/...` and `/en/...`. Header has a language switch that keeps the current page. Preference remembered in `localStorage` (this is the site's own storage; fine).
- **No hard-coded user-facing strings anywhere**. Every string is a key in `src/locales/{ar,en}.json`, both languages always updated together. Message keys/texts from `docs/i18n/*.json` are the starting point (placeholders use i18next `{{name}}` syntax).
- Any new Arabic text Copilot writes must be marked in the final note as "needs owner review".
- Use CSS **logical properties** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start/end`) — never `left/right` for layout. Icons that imply direction (arrows, chevrons) flip in RTL.
- Digits: Western digits (0-9) in both languages. Currency shown as `12,500 EGP` (en) / `12,500 ج.م` (ar), via one `formatMoney(minorUnits, lang)` helper.
- Dates: Africa/Cairo timezone, Gregorian calendar, `Intl.DateTimeFormat` with the active locale.
- Product name/description exist in both languages (`name_ar/name_en`, …). If one is empty, fall back to the other (admin form requires both; BR 11.2).
- Fonts per language: see `DESIGN.md`.

## 9. Ready-made database (already written and tested)
The SQL in `supabase/migrations/` (001 → 003) + `supabase/seed.sql` implements §3–§5 and BUSINESS_RULES §3–§5, §8–§10. **Copilot must NOT rewrite or "improve" these files**; frontend code only calls them.
- Errors come back as `error.message = '<KEY>'` (e.g. `CHECKOUT_STOCK_CONFLICT`, `CART_PRICE_CHANGED`, `ORDER_STATUS_CHANGED`, `FORBIDDEN`, `NOT_FOUND`, `REASON_REQUIRED`, `STOCK_NEGATIVE`, `PRODUCT_NOT_PUBLISHABLE`, `ILLEGAL_PRODUCT_TRANSITION`, `PRODUCT_NOT_ACTIVE`, `ADDRESS_LIMIT`, `ADDRESS_NOT_FOUND`, `CART_EMPTY`, `INVALID_INPUT`, `PAYMENT_METHOD_UNSUPPORTED`). Structured info (conflict lists) is JSON text in `error.details`. Map every key to an i18n message; unknown keys → `PAGE_500`.
- Place order flow: save/choose address → `validate_cart()` → `place_order(uuid, address_id)`. Generate the idempotency UUID once when the user enters the Review step and reuse it on retries.
- `product_images.path` starting with `/` is a public asset (sample data); otherwise it is a path in the `product-images` Storage bucket.
- Money columns are integer piasters. `app_settings` holds the constants; `businessConfig.ts` must equal it (add a test that reads `app_settings`).
- If a rule must change, tell the owner; a new numbered migration file is added (never edit an applied one).
