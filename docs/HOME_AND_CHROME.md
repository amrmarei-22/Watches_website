# Home page v2, Header, Footer, Static pages (amends PROJECT_SPEC §5 and DESIGN §4)

Rule: show only what is backed by **data** or by **owner-confirmed facts**. Never invent claims (authenticity guarantee, warranty, free shipping, return policy, customer counts, awards, reviews). Anything marked **[OWNER INPUT]** renders **only when filled** in `businessConfig.ts`; when empty, the item/section is hidden (no placeholder text, no fake data).

## 1. Header (storefront)
Order (reading order, mirrored automatically in RTL):
1. **Logo** (links to Home).
2. **Primary nav group:** `Home` · `Shop`.
3. **Utility group (end side):** `Account` (Login for guests / My Account menu for customers) · `Cart` (with count) · **Language switch LAST**.
- Language switch: small outlined pill showing the target language name ("English" / "العربية"), same height as the other items, muted text, accent on hover. It keeps the current page when switching.
- Active route: accent underline (logical properties). One scroll-progress bar (2px, accent) at the bottom edge of the header, driven by scroll (transform scaleX).
- Mobile: logo + cart + menu button; drawer contains Home, Shop, Account, language switch (last).

## 2. Footer (every storefront page)
Four columns on desktop (stacked accordions or plain stacked blocks on mobile):
1. **Brand:** logo + one-line tagline **[OWNER INPUT: `brand.taglineAr/En`]**, language switch.
2. **Shop:** Shop, then Men / Women / Unisex (links to `/shop?gender=…`).
3. **Your account:** Login or My Account, My Orders (customers), Cart.
4. **Help:** Contact us, Shipping & delivery, Privacy policy, Terms & conditions.
Contact block (inside column 4 or as a row): WhatsApp, phone, email, working hours, Instagram/Facebook **[OWNER INPUT: `contact.*`]** — render each item only if non-empty; WhatsApp becomes a `https://wa.me/<number>` link.
Bottom bar: `© {year} {brand name} — {All rights reserved}` and the facts "Cash on delivery" · "Delivery to all governorates of Egypt" (both are confirmed by BUSINESS_RULES §5.5 and §6.1).
The Admin area has no storefront footer.

## 3. Home page sections (in order)
1. **Hero** (full viewport height on desktop): headline + subtitle + one primary CTA "Shop watches". Visual: a large watch image (primary image of the first featured product; fall back to the brand dial illustration). Headline/subtitle copy: **[OWNER INPUT]**, use the proposals in `src/locales/NEEDS_REVIEW.md` until confirmed.
2. **Featured showcase:** featured products (BR 8.7). Pinned scene on desktop, simple list otherwise (DESIGN §5). Hidden if there are no featured products.
3. **Shop by gender:** three large tiles (Men / Women / Unisex), each linking to `/shop?gender=<key>`, each showing the primary image of the most recently added ACTIVE product of that gender. Hide a tile whose gender has no ACTIVE products.
4. **New arrivals:** the 4 most recent ACTIVE products (`created_at` desc), product cards, "View all" link.
5. **Brands strip:** distinct brands of ACTIVE products, each linking to the listing filtered by brand. Hidden when there is only one brand? No: show it (one brand is fine) but as a simple heading row, not a carousel.
6. **Trust strip:** only facts that exist: "Cash on delivery" and "Delivery to all governorates of Egypt". Additional promises (original guarantee, warranty, exchange, delivery time) appear ONLY if listed in `businessConfig.promises` **[OWNER INPUT]**; each with an icon (lucide) and a localized text supplied by the owner.
7. Footer.
Every section has a heading from i18n, generous vertical rhythm (96–128px desktop / 64px mobile), and the loading/empty/error states from UI_STATES.md.

## 4. Static pages (new; add to the router under `/ar/` and `/en/`)
`/contact`, `/shipping`, `/privacy`, `/terms`.
- Content lives in `src/content/pages/<slug>.<lang>.md` rendered by one `StaticPage` component (readable width 70ch, headings, lists). No markdown library without owner approval: ask first (a tiny parser may be written, or content stored as JSON blocks).
- If the file for a language is missing or empty, show `pages.contentPending` and mark the page `noindex`.
- **Contact page:** shows the same `contact.*` items as the footer (only filled ones). No contact form in v1 (not in spec).
- **Legal pages (privacy, terms) and shipping policy:** the owner supplies the text; Claude may supply a DRAFT that a qualified person must review before launch. Never publish AI-drafted legal text unreviewed.
- Footer links to these pages are visible only when the page has content, or always (owner decision #32).

## 5. Config additions (`businessConfig.ts`)
```ts
brand: { nameEn, nameAr, taglineEn: '', taglineAr: '' },
contact: { whatsapp: '', phone: '', email: '', hoursEn: '', hoursAr: '', instagram: '', facebook: '' },
promises: [] as { icon: string; textEn: string; textAr: string }[],
```
Empty strings/arrays are valid and hide the related UI.

## 6. Acceptance checks
- Language switch is the last item in the header utility group, in both directions.
- Footer has all four groups, correct links, © line with current year, hides every empty contact item.
- Home shows no section built on missing data and no text that claims anything not in this file or in the data.
- No horizontal scroll at 360px; keyboard order = visual order; all new strings in BOTH locale files.

## 7. Layout details added after visual review
- **Footer grid:** ≥1024px: `grid-template-columns: 1.4fr 1fr 1fr 1fr` (brand wider). 640–1023px: 2 columns. <640px: 1 column. In every column the **heading is above** and the links are a **vertical list** (12px gap). Heading style: small, muted, uppercase with letter-spacing in English only (never letter-spacing in Arabic). Column 2 first link is `footer.allWatches` (→ /shop), then Men / Women / Unisex.
- **Footer language switch:** the same compact pill as the header (auto width), never stretched.
- **Footer bottom bar:** `© {year} {brand} — {rights}` on the start side; the two confirmed facts (`home.cod`, `home.delivery`) on the end side, wrapping on small screens.
- **Brands strip:** brand names as large serif text links with an accent underline on hover (not pills), spaced with `gap: 24px 40px`.
- **Trust strip:** each item = icon (lucide, 24px, accent) + text; items separated by thin dividers; 2–4 columns; heading `home.trustTitle` (owner may change it).
- **i18n rule (applies to ALL files):** locale JSON must use nested objects only. Flat dotted keys like `"home.cod"` are forbidden because i18next reads the dot as a separator. Production must never display a raw key.
