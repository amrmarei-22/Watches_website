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

### Motion v2 additions (approved by owner; same rules as above)
| Place | Effect |
|-------|--------|
| Hero visual | The watch dial's hands settle to the current local time on load (rotate transform, 900 ms), then a slow second hand sweep (CSS, paused under reduced motion). Subtle parallax on scroll (desktop) |
| Section headings | A thin accent line draws in (scaleX, 600 ms) and the heading text rises with a mask reveal when it enters the viewport |
| Shop-by-gender tiles | Image parallax inside its mask (±24px) plus slow zoom on hover; arrow icon slides toward the end edge on hover (direction-aware) |
| New arrivals / listing | Cards stagger in per visible batch; on hover the second image crossfades and a "View" label fades up |
| Header | 2px accent scroll-progress bar (scaleX); background/blur transition after 24px |
| Footer | Columns reveal with a short stagger the first time the footer enters the viewport |
| Buttons (primary) | A soft light sweep across the button on hover (transform only), none on touch devices |
Never animate: prices, form fields, error/empty states, admin screens.

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

## 10. Hero dial (no-photo hero) and featured showcase layout (added after visual review)

### 10.1 `<HeroDial />` (SVG component, decorative)
Used as the hero visual when there is no real product photo (rule: if the first featured product's primary image path starts with `/placeholders/`, or there is no featured product, render `HeroDial`; otherwise render the photo).
- Size `min(80vw, 560px)`, square, `aria-hidden="true"` (the headline carries the meaning).
- Layers, back to front: soft gold glow (blurred circle, 15% opacity) → bezel (conic/linear gold gradient, 3 rings) → dial face (radial gradient charcoal → near-black) with faint concentric "guilloché" circles (opacity ≤ 0.06) → 60 minute ticks + 12 gold baton hour markers → small wordmark "VINTAGE" above center (Cormorant, letter-spaced) and tiny "AUTOMATIC" below → crown at 3 o'clock.
- Hands: hour and minute hands (baton with a lighter inner strip), thin gold seconds hand with counterweight, center cap.
- Motion (see §5, reduced-motion rules apply): on load the hour/minute hands sweep from 12:00 to the visitor's current local time (900–1200 ms, ease-out); the seconds hand then sweeps continuously (CSS rotation, 60 s linear, `steps` not required); on pointer devices a subtle tilt/parallax (±4°) follows the cursor. Under reduced motion: static hands at the current time, no sweep, no tilt.
- Colors only from design tokens; works in light and dark.

### 10.2 Featured showcase scene (desktop pinned)
- One scene = one featured product. Layout: image panel ≥ 45% of the width (large), text panel: brand (small caps), name (serif, large), price, up to three spec chips (movement, material, case size, labels from locale files), and a primary CTA button `cta.viewWatch` linking to the product page. **Never repeat the product name as link text next to the price.**
- Scene counter `01 / 04`, previous/next buttons and dots. They are real buttons, keyboard operable, and move to the matching scroll position; the scene never traps focus and every product is reachable by Tab.
- Pinning: the pinned section is exactly one viewport tall; when the last scene ends the next section follows immediately (**no dead space below**). Verify at 1366×768 and 1920×1080.
- Below 1024px or under reduced motion: stacked list of the same cards, simple reveals.

### 10.3 Section rhythm
Tokens: `--section-y: 96px` (desktop) / `64px` (mobile); `--heading-gap: 32px` between a section heading and its content; a short accent line (40px) under each heading. Headings and their content must never touch.
