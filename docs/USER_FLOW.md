# User Flow (Storefront)

Notation: `→` next step, `[E]` error/edge case. Rule IDs refer to BUSINESS_RULES.md. Messages keys refer to UI_STATES.md.

## F1. Browse & discover (GUEST / CUSTOMER)
1. Home: featured products (BR 8.7), brand links, link to Listing.
2. Listing: search (BR 7.2), filters (7.3), sort (7.4), pagination (7.5). State is in the URL.
3. [E] No results → Empty state `LISTING_EMPTY` with "Clear filters".
4. [E] Request fails → `LISTING_ERROR` with Retry.
5. Click product → Product Details.

## F2. Product Details
- Shows: gallery, name, brand, price, specs, description, availability message, quantity selector, Add to cart.
- By availability (PRODUCT_STATES §3): IN_STOCK normal; LOW_STOCK shows "Only {n} left"; OUT_OF_STOCK disables button.
- [E] Product DRAFT/ARCHIVED/nonexistent → 404.
- Add to cart: GUEST → Login with `returnTo` set to the product page; CUSTOMER → success → mini-cart toast `CART_ADDED`; qty above allowed → clamp + `CART_QTY_CLAMPED`.

## F3. Cart
1. Open cart → server revalidation (BR 3.6) → show changes.
2. Change quantity (1..max), remove line, see subtotal.
3. Empty → `CART_EMPTY` with "Continue shopping".
4. "Checkout":
   - GUEST → Login (returnTo=/checkout). After login cart merges (BR 3.2).
   - CUSTOMER unverified → blocked with `AUTH_VERIFY_REQUIRED`.
   - CUSTOMER verified → Checkout.

## F4. Registration
Register form (BR 1.1) → account created → "Check your email" screen → click link → `Verify Email` page: success → `AUTH_VERIFIED`; [E] expired/used token → `AUTH_VERIFY_EXPIRED` with "Resend link".
[E] email already registered → `AUTH_EMAIL_TAKEN`. [E] validation errors inline per field.

## F5. Login
Form → valid → redirect to `returnTo` or Home. [E] wrong → `AUTH_INVALID_CREDENTIALS`. [E] locked → `AUTH_LOCKED`. [E] disabled account → `AUTH_DISABLED`.
Forgot password → email form → always `AUTH_RESET_SENT` → link → new password form → success → Login. [E] token invalid → `AUTH_RESET_INVALID`.

## F6. Checkout (CUSTOMER verified)
**Step 1 — Address**
- Choose a saved address or add a new one (BR 6.2, 6.3). Governorate select (BR 6.1).
- [E] no saved addresses → show the add form directly.
**Step 2 — Review & payment**
- Show lines, subtotal, shipping fee, total, payment method = Cash on Delivery (BR 5.5).
- Server revalidates the cart on entry (BR 3.6).
- "Place order" button disabled + spinner while submitting (BR 5.6).
**Step 3 — Result**
- Success → Confirmation page: order number, summary, status PENDING, link to Order Details. Cart is now empty.
- [E] stock conflict → `CHECKOUT_STOCK_CONFLICT`, back to Cart with affected items highlighted (BR 5.1).
- [E] session expired → BR 1.7.
- [E] network/server error → `CHECKOUT_ERROR`; the user can retry safely (idempotent).
- [E] user navigates back after success → cart is empty, show Confirmation or Orders, never re-submit.

## F7. My Orders
- List newest first with order number, date, status badge, total. Paginated (10).
- Empty → `ORDERS_EMPTY`.
- Order Details: lines (snapshots), address snapshot, totals, status timeline (ORDER_STATES §4.4), Cancel button only when legal (PENDING) → confirm dialog → success `ORDER_CANCELLED` / [E] too late (status changed) → `ORDER_CANCEL_TOO_LATE`.
- [E] other user's order or nonexistent → 404.

## F8. My Account
Edit name, phone; manage addresses (add/edit/delete/set default, max 5 — BR 6.4); change password (needs current password; invalidates other sessions).

## F9. Session expiry anywhere (BR 1.7)
Any 401 → `AUTH_SESSION_EXPIRED` → Login with returnTo → after login back to same page.
