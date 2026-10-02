# Design Direction

Goal: a **professional, calm, premium** watch store that makes buying simple. Elegance comes from restraint: generous whitespace, large photography, precise typography, and purposeful motion.

> Design skills (ui-ux-pro-max, etc.) may refine execution but must follow this document. Do not add pages, features or copy not defined in `docs/`.

## 1. Mood & principles
1. **Quiet luxury** — dark/neutral canvas, one metallic accent, no gradients-everywhere, no neon, no heavy shadows.
2. **Product is the hero** — large images, minimal chrome around them.
3. **Simple for the user** — one primary action per screen, short forms, clear states, no dead ends.
4. **Motion with meaning** — guides attention, confirms actions, never decorates for its own sake, never blocks.
5. **Bilingual first-class** — Arabic RTL and English LTR are designed equally, not mirrored as an afterthought.

## 2. Color tokens (CSS variables in `styles/tokens.css`; light + dark both defined)
| Token | Dark (default for hero/brand sections) | Light |
|-------|------|-------|
| `--bg` | `#0E0E10` | `#FAF8F5` |
| `--surface` | `#17171A` | `#FFFFFF` |
| `--surface-2` | `#202024` | `#F1EEE8` |
| `--text` | `#F4F1EA` | `#17171A` |
| `--text-muted` | `#A7A39A` | `#6B675F` |
| `--accent` (champagne gold) | `#C8A96A` | `#9C7F3F` |
| `--accent-contrast` | `#0E0E10` | `#FFFFFF` |
| `--border` | `rgba(244,241,234,.12)` | `rgba(23,23,26,.12)` |
| `--success` | `#4CAF7A` | `#2E7D55` |
| `--warning` (low stock) | `#E0A63A` | `#B7791F` |
| `--danger` (out of stock / errors) | `#E5635A` | `#C0392B` |
Respect `prefers-color-scheme`; a manual theme switch is NOT in scope unless added to the spec. Contrast must meet WCAG AA (text 4.5:1). Never convey status by color alone (use text/icon too).

## 3. Typography
| Use | English | Arabic |
|-----|---------|--------|
| Display / headings | Cormorant Garamond (500–600) | Amiri (700) — or Noto Naskh Arabic if Amiri renders poorly |
| Body / UI | Inter | IBM Plex Sans Arabic |
Load from Google Fonts (or self-host), `font-display: swap`, only needed weights. Scale (rem): 0.875 / 1 / 1.125 / 1.5 / 2 / 3 / 4.5 (hero). Arabic body line-height 1.8, English 1.6. Prices use tabular numbers. Never use letter-spacing on Arabic text.

## 4. Layout & components
- Container max-width 1280px; 4/8px spacing scale; 12-col grid desktop, 4-col mobile. Radius: 4px (inputs/cards) — keep corners subtle, premium feel.
- Header: logo, nav (Shop, Brands…only pages that exist), language switch, account, cart with count. Sticky, becomes solid on scroll. Mobile: hamburger drawer.
- Product card: large image (4:5), brand (small caps), name, price, availability badge when LOW/OUT. Second image on hover (desktop only).
- Product page: gallery (left/start) + sticky info panel (right/end). On mobile, **sticky Add-to-cart bar** at bottom.
- Cart: slide-in drawer from the end edge + full Cart page (both exist in spec: drawer = mini-cart toast target; see USER_FLOW F3).
- Checkout: 3-step progress indicator (Address → Review → Done), summary always visible (side panel on desktop, collapsible on mobile).
- Forms: labels above inputs, inline validation on blur, error text under field, 48px min tap targets, correct `inputmode`/`autocomplete` (e.g., `tel`, `email`).
- Admin: functional, dense, neutral, light theme default; **minimal motion** (only focus/hover/toasts/dialogs). Tables with sticky headers, row actions, clear status badges.

## 5. Motion system (storefront only)
Libraries: `motion` for component-level, `gsap` + ScrollTrigger for scroll scenes, `lenis` smooth scroll (optional; if not installed use native scroll).
Rules for all animation:
- Animate **transform and opacity only** (no layout-thrashing properties). Target 60fps.
- Durations: micro 150–250ms, UI 300–450ms, scenes 600–1000ms. Easing: `cubic-bezier(.22,1,.36,1)` (ease-out expo-like). No bounces.
- `prefers-reduced-motion: reduce` → disable parallax/pinning/auto-play; keep only instant opacity changes.
- Direction-aware: horizontal slide animations flip in RTL.
- Animations never delay content access or hide loading/error/empty states. Content must be usable if JS animations fail.
- Mobile: no pinned scroll scenes; use simple reveal-on-scroll only.

### Where motion is used (exhaustive for v1)
| Place | Effect |
|-------|--------|
| Home hero | Headline lines reveal (mask/slide up), hero watch image slow scale/parallax on scroll |
| Home sections | Reveal on scroll (fade+rise, staggered 60–80ms) for featured products & brand blocks |
| Home featured showcase (desktop) | One pinned ScrollTrigger scene cycling featured watches as the user scrolls |
| Product card | Hover: image crossfade/slow zoom (1.04), price/CTA subtle shift. Focus-visible ring |
| Listing | Cards stagger-in on first load and after filter change; skeletons while loading |
| Product page | Gallery image zoom on hover/tap, thumbnail crossfade; info panel reveal |
| Add to cart | Button success micro-state (check icon) + cart badge pop + drawer slide-in |
| Cart drawer / dialogs | Slide/fade with backdrop; focus trapped |
| Page transitions | Short fade (≤250ms) between routes |
| Checkout steps | Progress bar fill, step content crossfade |
| Toasts | Slide in from the end edge, auto-dismiss 4s |
| Header | Background/blur transition on scroll past 24px |
No other animation without owner approval.

## 6. Imagery
- Owner supplies real product photos (clean background, consistent aspect 4:5, ≥1600px). 
- Until then use clearly marked **SAMPLE placeholders** (local files in `public/placeholders/`). Never hotlink random web images or use copyrighted brand photos/logos.
- All `<img>`: explicit width/height, `loading="lazy"` (except hero), descriptive localized `alt`.

## 7. Content & tone
Short, calm, confident microcopy. Messages are only those in `docs/i18n`. New marketing copy (hero headline, section titles) must be requested from the owner or proposed in both languages marked "needs review".

## 8. UX simplifications (apply within existing flows; none add features)
- Listing: filters in a drawer on mobile, sidebar on desktop; active filters shown as removable chips; result count visible.
- Product page: price, availability and Add-to-cart visible without scrolling on desktop.
- Cart/Checkout: never ask for info twice; pre-fill from saved default address/profile.
- Show exactly one primary button per screen/step; secondary actions as text links.
- Every error says what happened and what to do next (messages in `docs/i18n`).
- Keep checkout to the 3 steps in USER_FLOW F6.

## 9. Performance budget
LCP < 2.5s on mid-range mobile; hero image preloaded, responsive `srcset`; code-split routes (admin chunk separate); GSAP/ScrollTrigger loaded only on pages that use it.

## 10. Brand (working identity — owner may change)
- Name: **Vintage** (Arabic: **فينتج**). Defined once in `src/config/brand.ts` `{ name: {en:'Vintage', ar:'فينتج'}, tagline: null }`. Never hard-code the name elsewhere.
- Logo mark: `public/brand/logo-mark.svg` (gold ring with V-shaped watch hands). Favicon: `public/brand/favicon.svg` (update `index.html` to use it).
- Header lockup: mark (32px) + wordmark in the display font (Cormorant Garamond for EN / Amiri for AR), uppercase letter-spacing .18em for EN only, accent color for the mark, `--text` for the wordmark.
- Tagline: none until the owner provides one (do not invent).
- Placeholder watches: `public/placeholders/watch-1..6.svg` (4:5, marked SAMPLE). Replaced by real photos later; code must treat any image path starting with `/` as a local asset (see API.md §2).
