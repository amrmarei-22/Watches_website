# Luxury Watches Platform — Project Spec

## 1. Purpose
An online store selling luxury watches. Visitors browse and search; customers register, order, and track orders; an admin manages products, inventory, orders, and users.

## 2. Roles
| Role | Definition |
|------|------------|
| GUEST | Not logged in. |
| CUSTOMER | Logged in, email verified (see BUSINESS_RULES §1). |
| ADMIN | Seeded account with full management access. Never created via public registration. |

A user has exactly ONE role. An ADMIN does not shop with the same account.

## 3. Glossary
- **Stock**: integer count of sellable units (>= 0). Never negative.
- **Availability**: derived value `IN_STOCK | LOW_STOCK | OUT_OF_STOCK` computed from stock + threshold (PRODUCT_STATES).
- **Product status**: stored value `DRAFT | ACTIVE | ARCHIVED` (PRODUCT_STATES).
- **Order status**: `PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED` (ORDER_STATES).
- **Minor units**: money as integers in piasters.
- **Line**: one product + quantity inside a cart or order.

## 4. Product data model (fields Copilot may use; add none without asking)
Product: `id, sku (unique), name, brand, description, price (minor units), stock (int>=0), lowStockThresholdOverride (int|null), status, featured (bool), images[], specs{ caseSize, movement, material, waterResistance, strap, gender }, createdAt, updatedAt`.

User: `id, name, email (unique), phone, passwordHash, role, emailVerified, createdAt`.

Address: `id, userId, fullName, phone, governorate, city, street, building, notes`.

Order: `id, orderNumber, userId, status, lines[], subtotal, shippingFee, total, paymentMethod, shippingAddressSnapshot, statusHistory[], createdAt, updatedAt`.
OrderLine: `productId, skuSnapshot, nameSnapshot, unitPriceSnapshot, quantity, lineTotal`.
StatusHistory entry: `from, to, actorId, actorRole, reason|null, timestamp`.

## 5. Storefront pages (exhaustive)
Home, Product Listing (search/filter/sort), Product Details, Cart, Login, Register, Verify Email, Forgot/Reset Password, Checkout (Address → Review/Payment → Confirmation), My Orders, Order Details, My Account (profile + addresses), 404, 403, 500.

## 6. Admin pages (exhaustive)
Admin Login, Dashboard, Products (list/add/edit), Inventory, Orders (list/details), Users (list/details).

## 7. Out of scope (v1) — do NOT build
Wishlist, reviews/ratings, coupons/discounts, returns/refunds, multi-currency, online card payments, social login, notifications (email/SMS), gift wrapping, product variants/colors as separate SKUs, multi-warehouse, admin sub-roles, blog/CMS, live chat, comparison tool.

## 8. Non-functional requirements
- Responsive: mobile (360px) to desktop (1440px+).
- Performance: listing paginated (12 per page); images lazy-loaded.
- Security: HTTPS only; passwords hashed (argon2/bcrypt); CSRF protection; rate-limit auth endpoints; server-side authorization on every endpoint.
- Accessibility: WCAG 2.1 AA target.
- Timezone: store and compute in UTC, display in Africa/Cairo.
