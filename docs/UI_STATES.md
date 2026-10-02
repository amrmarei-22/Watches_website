# UI States & Messages

Every screen implements: **loading, empty, error, success, disabled**. Copilot must use these exact message keys and English text (translate only once languages are confirmed — OPEN_DECISIONS #2; keep keys stable).

## 1. Generic patterns
| State | Pattern |
|-------|---------|
| Loading (page/list) | Skeleton placeholders matching layout; no layout shift. Spinner only inside buttons. |
| Loading (button) | Button disabled, spinner, label unchanged width. |
| Empty | Icon/illustration + one-line message + one primary action. |
| Error (page/list) | Message + "Try again" button. Never show raw error text/stack. |
| Error (field) | Inline text under the field, `aria-describedby`, red border. |
| Error (form-level) | Alert at top of form with `role="alert"`. |
| Success | Toast (auto-dismiss 4s, `aria-live="polite"`), or Confirmation page for orders. |
| Disabled | Visually dimmed, `disabled` attribute, tooltip/explanatory text where reason isn't obvious. |
| Destructive actions | Confirm dialog stating the consequence; default focus on Cancel. |

## 2. Messages
### Auth
- `AUTH_INVALID_CREDENTIALS`: "Incorrect email or password."
- `AUTH_LOCKED`: "Too many attempts. Try again in 15 minutes."
- `AUTH_DISABLED`: "This account has been disabled. Please contact support."
- `AUTH_EMAIL_TAKEN`: "An account with this email already exists."
- `AUTH_VERIFY_REQUIRED`: "Please verify your email before placing an order."
- `AUTH_VERIFIED`: "Your email has been verified."
- `AUTH_VERIFY_EXPIRED`: "This verification link is invalid or has expired."
- `AUTH_RESET_SENT`: "If an account exists for this email, a reset link has been sent."
- `AUTH_RESET_INVALID`: "This reset link is invalid or has expired."
- `AUTH_SESSION_EXPIRED`: "Your session has expired. Please log in again."
### Listing / product
- `LISTING_EMPTY`: "No watches match your search."  Action: "Clear filters"
- `LISTING_ERROR`: "We couldn't load the watches."  Action: "Try again"
- `PRODUCT_LOW_STOCK`: "Only {n} left"
- `PRODUCT_OUT_OF_STOCK`: "Out of stock"
### Cart
- `CART_EMPTY`: "Your cart is empty."  Action: "Continue shopping"
- `CART_ADDED`: "Added to cart."
- `CART_QTY_CLAMPED`: "Quantity adjusted to the available amount ({n})."
- `CART_PRICE_CHANGED`: "The price of {name} has changed."
- `CART_ITEM_UNAVAILABLE`: "{name} is no longer available and was removed from your cart."
### Checkout / orders
- `CHECKOUT_STOCK_CONFLICT`: "Some items are no longer available in the requested quantity. Please review your cart."
- `CHECKOUT_ERROR`: "We couldn't place your order. You have not been charged. Please try again."
- `ORDERS_EMPTY`: "You haven't placed any orders yet."  Action: "Start shopping"
- `ORDER_CANCELLED`: "Your order has been cancelled."
- `ORDER_CANCEL_TOO_LATE`: "This order can no longer be cancelled."
### Admin
- `ADMIN_SAVED`: "Changes saved."
- `ADMIN_EDIT_CONFLICT`: "This item was changed by someone else. Reload to see the latest version."
- `PRODUCT_SKU_TAKEN`: "This SKU is already in use."
- `IMAGE_INVALID`: "Images must be JPG, PNG or WebP and under 5 MB."
- `FEATURED_LIMIT`: "You can feature up to 8 products."
- `ORDER_STATUS_UPDATED`: "Order status updated."
- `ORDER_STATUS_CHANGED`: "This order was updated by someone else. It has been reloaded."
- `ORDER_ILLEGAL_TRANSITION`: "This status change isn't allowed."
- `ADMIN_SELF_DISABLE`: "You can't disable your own account."
### System pages
- 403: "You don't have access to this page."  Action: "Go home"
- 404: "We couldn't find that page."  Action: "Go home"
- 500: "Something went wrong on our side."  Action: "Try again"

## 3. Form validation messages
- Required: "{field} is required."
- Email: "Enter a valid email address."
- Phone: "Enter a valid Egyptian mobile number (11 digits)."
- Password: "At least 8 characters with a letter and a number."
- Confirm password: "Passwords don't match."
- Length: "{field} must be between {min} and {max} characters."
- Price: "Enter a price greater than 0."
- Stock: "Stock must be a whole number, 0 or more."

## 4. Motion / visual rules (placeholder)
Visual identity, palette, typography, and animation rules are NOT defined yet. Copilot must ask for the design direction (or a `docs/DESIGN.md`) before styling beyond neutral defaults. Respect `prefers-reduced-motion`.
