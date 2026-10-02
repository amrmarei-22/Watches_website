# OPEN DECISIONS (owner must confirm)

Legend: **[DEFAULT]** = documented working default so docs are complete; Copilot may implement it but must keep it in `businessConfig.ts` so it is a one-line change. **[BLOCKER]** = Copilot must ask before implementing anything that depends on it.

| # | Decision | Status | Working default |
|---|----------|--------|-----------------|
| 1 | Tech stack | **DECIDED** | Vite+React+TS, Supabase backend, see `TECH_STACK.md`. Owner must create the Supabase project and supply keys. |
| 2 | Languages & direction | **DECIDED** | Arabic (RTL, default) + English (LTR). See `TECH_STACK §8`. |
| 3 | Payment methods | [DEFAULT] | Cash on Delivery only in v1. Online card = out of scope until confirmed. |
| 4 | Currency | [DEFAULT] | EGP, stored as integer piasters (1 EGP = 100). |
| 5 | Shipping fee | [DEFAULT] | Flat fee per order, configurable `SHIPPING_FLAT_FEE`. Value TBD by owner (use 0 until set). |
| 6 | Shipping coverage | [DEFAULT] | All Egyptian governorates. List in `BUSINESS_RULES §6`. |
| 7 | Low-stock threshold | [DEFAULT] | 3 units (global), optional per-product override. |
| 8 | Max quantity per cart line | [DEFAULT] | min(available stock, 3). |
| 9 | Customer self-cancel | [DEFAULT] | Allowed only while order is PENDING. |
| 10 | Returns / refunds | [DEFAULT] | Out of scope v1. DELIVERED is terminal. |
| 11 | Email/SMS notifications | [DEFAULT] | Out of scope v1 (only on-screen status). |
| 12 | Email verification on registration | [DEFAULT] | Required before checkout. |
| 13 | Social login (Google etc.) | [DEFAULT] | Out of scope v1. |
| 14 | Product images per product | [DEFAULT] | 1–8 images, first = primary; max 5 MB each; jpg/png/webp. |
| 15 | Admin accounts creation | [DEFAULT] | Created manually/seeded; no public admin registration. Single ADMIN role (no sub-roles). |
| 16 | Phone number format | [DEFAULT] | Egyptian mobile: 11 digits starting 010/011/012/015. |
| 17 | Tax / VAT | [DEFAULT] | Prices are VAT-inclusive; no separate tax line. |
| 18 | Guest cart persistence | [DEFAULT] | Browser storage, 30 days; merged into account cart at login. |
| 19 | Reservation of stock | [DEFAULT] | Stock is decremented when the order is created (PENDING), restored on cancel. |

Rule for Copilot: when a task touches a **[BLOCKER]** row, ask the owner. When it touches a **[DEFAULT]** row, implement the default via config and mention it in the task's traceability note.
| 20 | Per-account login lockout (BR 1.6) | [DEFAULT] | Supabase Auth has rate limits but, as far as we know, no per-account lockout. Verify in Supabase docs. Options: (a) custom `login_attempts` + RPC/edge function, (b) rely on Supabase rate limiting + CAPTCHA and relax BR 1.6. **Working default: (b)** — rely on Supabase's built-in rate limiting now; implement (a) later if the owner wants it. |
| 21 | Server-side idle timeout (BR 1.7) | [DEFAULT] | Client-side idle timer + short-lived JWT. True server-side inactivity timeout may need a paid Supabase plan — verify. |
| 22 | Email sending for verification/reset | [DEFAULT] | Supabase built-in email for development (low limits). Production needs a custom SMTP provider — owner to choose. |
| 23 | SEO | [DEFAULT] | Stay on Vite SPA. Set per-page `<title>`/meta. If Google ranking of product pages later proves important, migrate to Next.js. |
| 24 | Default language | [DEFAULT] | Arabic. Digits: Western (0-9). Currency label: EGP / ج.م. |
| 25 | Localized product content | [DEFAULT] | name/description required in both Arabic and English. |
| 26 | Spec enumerations (movement, material, strap, gender) | [DEFAULT] | Values listed in `i18n/en.json`. Owner may add/remove. |
| 27 | Real product photos | [DEFAULT] | Using generated SAMPLE placeholders (`public/placeholders/watch-1..6.svg`). Replace via admin upload / Storage when real photos exist. |
| 28 | Brand name & logo | [DEFAULT] | Working name **Vintage / فينتج** with the V-hands logo in `public/brand/`. Owner may rename at any time: change `src/config/brand.ts` (single source). |
| 29 | Hosting for frontend (Vercel / Netlify / Cloudflare Pages) | OPEN | Owner choice; no code impact. |
| 30 | Supabase project & keys | **[OWNER ACTION]** | Owner creates the project and fills `.env.local` (see `supabase/README.md`). Copilot must not invent keys. |
