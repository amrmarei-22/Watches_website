# Business Rules

Every rule has an ID. Code and tests reference these IDs. Constants live in `src/config/businessConfig.ts`.

## 0. Constants
| Constant | Value |
|----------|-------|
| `LOW_STOCK_THRESHOLD_DEFAULT` | 3 |
| `MAX_QTY_PER_LINE` | 3 |
| `SHIPPING_FLAT_FEE` | 0 until owner sets (minor units) |
| `PAGE_SIZE` | 12 |
| `SESSION_IDLE_TIMEOUT_MIN` | 30 (customer), 15 (admin) |
| `SESSION_ABSOLUTE_MAX_HOURS` | 12 (customer), 8 (admin) |
| `GUEST_CART_TTL_DAYS` | 30 |
| `MAX_FAILED_LOGINS` | 5 |
| `LOCKOUT_MINUTES` | 15 |
| `PASSWORD_MIN_LENGTH` | 8 |
| `EMAIL_VERIFY_TTL_HOURS` | 24 |
| `PASSWORD_RESET_TTL_MINUTES` | 60 |
| `MAX_IMAGES_PER_PRODUCT` | 8 |
| `MAX_IMAGE_MB` | 5 |
| `MAX_ADDRESSES_PER_USER` | 5 |

## 1. Authentication
- 1.1 Registration fields: name (2–60), email (valid, unique, case-insensitive), phone (BR 6.3), password (>= 8 chars, at least 1 letter and 1 digit), confirm password.
- 1.2 After registering, user is created with `emailVerified=false` and receives a verification link valid `EMAIL_VERIFY_TTL_HOURS`. (Email sending is infrastructure for verification only; no other emails in v1.)
- 1.3 Unverified user CAN log in and browse and use cart, but CANNOT place an order. At checkout they see message `AUTH_VERIFY_REQUIRED` with a "Resend link" action.
- 1.4 **Logged in** means: a valid, unexpired server session exists AND user is not locked. Defined solely by the server session, never by a client flag.
- 1.5 Wrong credentials → generic error `AUTH_INVALID_CREDENTIALS` (never reveal whether email exists). Counts toward failed attempts.
- 1.6 After `MAX_FAILED_LOGINS` consecutive failures for an account, lock login for `LOCKOUT_MINUTES`. Show `AUTH_LOCKED`. Counter resets on success.
- 1.7 Session expires after idle timeout or absolute max (see §0). On expiry mid-action: the action fails with 401, client shows `AUTH_SESSION_EXPIRED`, redirects to Login with `returnTo`, and after login returns the user to where they were. Cart is preserved. Form data in checkout is preserved in client memory when possible.
- 1.8 Logout destroys the session server-side. Cart persists on the server for CUSTOMER.
- 1.9 Password reset: link valid `PASSWORD_RESET_TTL_MINUTES`, single-use; response is identical whether or not the email exists (`AUTH_RESET_SENT`). Reset invalidates all existing sessions.
- 1.10 Admin login uses a separate page and the same auth mechanism; a CUSTOMER credential must never grant admin access and vice versa. Admin has no "Register" and no "Forgot password" self-service in v1 (reset by owner manually).

## 2. Permissions matrix
| Capability | GUEST | CUSTOMER | ADMIN |
|------------|:----:|:--------:|:-----:|
| View ACTIVE products, search, filter, sort | ✅ | ✅ | ✅ |
| View DRAFT/ARCHIVED product pages | ❌ (404) | ❌ (404) | ✅ (admin area only) |
| Add to cart | ✅ | ✅ | ❌ |
| Checkout / place order | ❌ (login required) | ✅ (verified only) | ❌ |
| View own orders | ❌ | ✅ | ❌ |
| View any order | ❌ | ❌ | ✅ |
| Cancel own order | ❌ | ✅ only if PENDING | ❌ |
| Manage profile & addresses | ❌ | ✅ | ❌ |
| Admin dashboard / products / inventory / orders / users | ❌ | ❌ | ✅ |

- 2.1 Unauthorized page access: GUEST → redirect to Login (with `returnTo`); CUSTOMER on admin route → 403 page; accessing another user's order → 404 (do not reveal existence).
- 2.2 Every API endpoint enforces permissions server-side via `permissions.ts`.

## 3. Cart
- 3.1 Guests may add to cart. Guest cart is stored client-side, TTL `GUEST_CART_TTL_DAYS`. Customer cart is stored server-side.
- 3.2 On login, guest cart merges into the customer cart: same product → quantities summed then capped by §3.4; different products → added.
- 3.3 Only ACTIVE products can be added. Adding LOW_STOCK is allowed; OUT_OF_STOCK is blocked.
- 3.4 Line quantity range: 1 to `min(currentStock, MAX_QTY_PER_LINE)`. Attempting to exceed → clamp to max and show `CART_QTY_CLAMPED`.
- 3.5 Cart never reserves stock. Stock is only deducted when an order is created (§5.1).
- 3.6 Cart is revalidated (price, stock, product status) on: cart page load, checkout start, and order placement. Changes are shown to the user:
  - price changed → use new price, show `CART_PRICE_CHANGED` listing the item
  - stock lower than qty → reduce qty, show `CART_QTY_CLAMPED`
  - product OUT_OF_STOCK / ARCHIVED / DRAFT → remove line, show `CART_ITEM_UNAVAILABLE`
- 3.7 Cart totals = sum(unitPrice × qty). Computed on the server; the client displays.
- 3.8 Removing the last line shows the Empty Cart state.

## 4. Inventory
- 4.1 Availability is **derived, never stored**: see `PRODUCT_STATES.md`.
- 4.2 Stock cannot be negative. Any operation that would make it negative fails.
- 4.3 Admin may set stock to an absolute value or adjust by +/-; every change records `{productId, before, after, delta, reason, actorId, timestamp}` in an inventory log.
- 4.4 Low-stock threshold = `product.lowStockThresholdOverride ?? LOW_STOCK_THRESHOLD_DEFAULT`.
- 4.5 The ONLY code allowed to decide availability is `getAvailability()` in `inventory.ts`.

## 5. Checkout & orders
- 5.1 Placing an order is ONE atomic server transaction: revalidate cart → check stock for all lines → deduct stock → create order (PENDING) → clear cart. If any line fails, nothing changes and the user sees `CHECKOUT_STOCK_CONFLICT` with the affected items; they return to Cart.
- 5.2 Concurrency: if two users buy the last unit, exactly one succeeds (use DB row lock or atomic conditional update `stock >= qty`). The other gets `CHECKOUT_STOCK_CONFLICT`.
- 5.3 Order stores snapshots (name, SKU, unit price, address). Later product/address edits never alter past orders.
- 5.4 Order number: `WS-YYYYMMDD-NNNNN` (NNNNN = zero-padded daily sequence), unique.
- 5.5 Payment method v1: `COD` only. Order total = subtotal + shippingFee. Payment is collected on delivery; no payment status tracking in v1.
- 5.6 Double-submit protection: placing an order uses an idempotency key; a repeated submit returns the same order and creates no duplicate.
- 5.7 If the session expires during checkout, see §1.7. No order is created unless the transaction in §5.1 completed.
- 5.8 Cancellation restores stock: on transition to CANCELLED, add each line's quantity back to its product's stock, in the same transaction, and log it in the inventory log with reason `ORDER_CANCELLED`.
- 5.9 Customer self-cancel only when PENDING. After that only ADMIN can cancel, and a cancellation reason is required.
- 5.10 Status changes follow `ORDER_STATES.md` only. Illegal transition → 409 `ORDER_ILLEGAL_TRANSITION`.

## 6. Shipping & address
- 6.1 Ship only within Egypt. Governorate must be one of: Cairo, Giza, Alexandria, Dakahlia, Red Sea, Beheira, Fayoum, Gharbia, Ismailia, Menofia, Minya, Qaliubiya, New Valley, Suez, Aswan, Assiut, Beni Suef, Port Said, Damietta, Sharkia, South Sinai, Kafr El Sheikh, Matrouh, Luxor, Qena, North Sinai, Sohag.
- 6.2 Address fields: fullName (required), phone (required), governorate (required), city (required), street (required), building (required), notes (optional, <= 200 chars).
- 6.3 Phone: Egyptian mobile, 11 digits, matches `^01[0125][0-9]{8}$`. Normalize by stripping spaces/dashes/`+20`.
- 6.4 Customer can save up to `MAX_ADDRESSES_PER_USER`; one may be default. Deleting an address never affects past orders (snapshots).
- 6.5 Shipping fee = `SHIPPING_FLAT_FEE` per order regardless of governorate (v1).

## 7. Search / filter / sort (listing)
- 7.1 Only ACTIVE products appear.
- 7.2 Search: case-insensitive, matches name, brand, SKU. Empty query = all.
- 7.3 Filters (combine with AND): brand (multi), price range (min/max), availability (In stock only toggle: LOW_STOCK counts as in stock), gender, movement, material.
- 7.4 Sort: Newest (default), Price low→high, Price high→low, Name A→Z. Ties broken by `createdAt desc`, then `id`.
- 7.5 Pagination: `PAGE_SIZE` per page; filter/sort/search/page are reflected in the URL query string so links are shareable and Back works.
- 7.6 OUT_OF_STOCK products ARE shown in listing (with "Out of stock" badge, no add-to-cart) unless "In stock only" is on.
- 7.7 Changing any filter/search/sort resets to page 1.

## 8. Product data rules (admin input)
- 8.1 SKU: unique, 3–30 chars, `A-Z0-9-`, immutable after creation.
- 8.2 Name 2–120 chars; brand required; description 0–5000 chars.
- 8.3 Price: integer > 0 in minor units; admin enters EGP with up to 2 decimals.
- 8.4 Stock: integer >= 0.
- 8.5 Images: 1–`MAX_IMAGES_PER_PRODUCT`, `MAX_IMAGE_MB` each, jpg/png/webp. At least 1 required to move DRAFT → ACTIVE.
- 8.6 A product can become ACTIVE only if: required fields valid, price > 0, >= 1 image.
- 8.7 `featured` products appear in Home's featured section; max 8 featured at once. Only ACTIVE products can be featured.

## 9. Deletion
- 9.1 Products are **never hard-deleted** if they appear in any order or cart. Admin "Delete" = move to ARCHIVED. A product with no history may be hard-deleted only while DRAFT.
- 9.2 Orders are never deleted.
- 9.3 Users are never hard-deleted in v1; admin can disable (blocks login). A disabled user's orders remain.

## 10. Audit
- 10.1 Log (who, what, when) for: product create/edit/archive, stock changes, order status changes, user enable/disable, admin logins.

## 11. Localization (amends earlier sections)
- 11.1 The store supports Arabic (default) and English. See `TECH_STACK §8`.
- 11.2 **Product fields are bilingual:** `name_ar`, `name_en`, `description_ar`, `description_en` replace `name` / `description` in BR 8.2 and in `PROJECT_SPEC §4`. Name AR/EN: 2–120 chars each, both required. Description AR/EN: 0–5000 chars each.
- 11.3 Order lines snapshot both `name_ar` and `name_en`; order pages show the active language.
- 11.4 Search (BR 7.2) matches name in both languages, brand, SKU. Arabic matching is normalized (ignore diacritics/tashkeel; treat أ إ آ ا as the same; ى = ي; ة = ه is NOT merged).
- 11.5 Sort "Name A→Z" uses the active language's collation (`Intl.Collator`).
- 11.6 Spec attributes `movement`, `material`, `strap`, `gender` are enumerations (keys in `i18n/*.json → specs`). `caseSize` (mm) and `waterResistance` (meters) are numbers. Filters in BR 7.3 use these keys.
- 11.7 Status labels and governorate names are always displayed from the locale files, never from raw enum/db values.
