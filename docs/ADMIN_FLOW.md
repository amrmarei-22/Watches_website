# Admin Flow

Admin area lives under `/admin`, with its own layout and login. All endpoints enforce ADMIN server-side (BR 2.2). Idle timeout 15 min.

## A1. Admin Login
Admin Login → valid → Dashboard. [E] invalid → `AUTH_INVALID_CREDENTIALS`; lock rules BR 1.6 apply. A CUSTOMER account here → same generic invalid error.

## A2. Dashboard
Shows counts (no charts required in v1): orders by status (PENDING highlighted), number of LOW_STOCK products, number of OUT_OF_STOCK products, latest 10 orders. Each count links to the filtered list.
Empty values show 0, never blank.

## A3. Products
**List**: table with image, name, SKU, price, stock, status, availability badge, featured. Search by name/SKU; filter by status and availability; sort by updated desc default; paginated (20).

**Add product**
```
Add Product → form → client validate → submit → server validate (BR 8.x)
   ├─ invalid → show field errors (nothing saved)
   └─ valid → create as DRAFT → product page (admin) → "Publish" available when BR 8.6 passes
```
Fields: SKU, name, brand, description, price, stock, low-stock override (optional), specs, images (upload, reorder, remove, choose primary), featured.
[E] duplicate SKU → `PRODUCT_SKU_TAKEN`. [E] image too large/wrong type → `IMAGE_INVALID`.

**Edit**: same form. SKU read-only. Price change applies to future orders only (BR 5.3). Save → success toast `ADMIN_SAVED`. [E] concurrent edit conflict (updatedAt mismatch) → `ADMIN_EDIT_CONFLICT` with "Reload".

**Publish / Unpublish / Archive / Restore**: per PRODUCT_STATES §2 table; confirm dialog for Unpublish/Archive explaining that it will be removed from carts.
**Delete**: shown only for DRAFT products with no history (BR 9.1); confirm dialog. Otherwise the button is "Archive".
**Featured toggle**: ACTIVE only; [E] 9th featured → `FEATURED_LIMIT`.

## A4. Inventory
Table of all non-archived products: stock, threshold, availability. Filters: Low stock, Out of stock.
Update stock: set exact value or +/- adjustment, reason required (select: RESTOCK, CORRECTION, DAMAGED, OTHER + note). Cannot go below 0 (BR 4.2). Writes inventory log (BR 4.3). Availability updates instantly (PRODUCT_STATES §3).
Per-product history view of inventory log.

## A5. Orders
**List**: filter by status, search by order number/customer email/phone, date range; newest first; paginated (20).
**Details**: customer info, address snapshot, lines, totals, status timeline, internal notes (admin-only, free text, append-only).
**Actions** (only legal ones for the current status — ORDER_STATES §5):
- Confirm / Start processing / Mark shipped (tracking optional) / Mark delivered → confirm dialog → success `ORDER_STATUS_UPDATED`.
- Cancel → dialog with REQUIRED reason → stock restored (BR 5.8).
[E] status changed by someone else meanwhile → `ORDER_STATUS_CHANGED`, order reloads.
[E] illegal transition (should not be reachable from UI) → 409 `ORDER_ILLEGAL_TRANSITION`.

## A6. Users
List with name, email, phone, role, verified, enabled, created date; search by name/email/phone.
Details: profile, addresses, their orders (read-only links).
Actions: Disable / Enable (BR 9.3) with confirm. Disabled user is logged out immediately (sessions revoked). Admin cannot disable themselves (`ADMIN_SELF_DISABLE`). Admin cannot change roles in v1.

## A7. Audit trail
Read-only list of audit events (BR 10.1) with filters by actor, entity, date. Minimal table view.
