# Brand

| Item | Value |
|------|-------|
| Name (EN) | **Vintage** |
| Name (AR) | **فينتج** |
| Status | Working name chosen by owner. Owner must check domain/trademark availability before launch. |
| Brand constant | `src/config/businessConfig.ts → brand = { nameEn: "Vintage", nameAr: "فينتج" }` — used everywhere (header, footer, `<title>`, emails). Never hard-code the name. |

## Logo
- **Mark:** `public/logo-mark.svg` — a watch-dial ring with 12 hour ticks, a "V" in the center and a crown on top. Uses `currentColor`, so it takes the accent color (champagne gold) or text color.
- **Wordmark:** rendered as **text** (not an image) next to the mark, so it follows the active language and fonts:
  - English: `VINTAGE` — Cormorant Garamond 600, uppercase, letter-spacing 0.2em.
  - Arabic: `فينتج` — Amiri 700, no letter-spacing.
- Lockups: horizontal (mark + wordmark) in the header; mark alone as favicon (export to 32/180/512 PNG when needed).
- Clear space around the logo = height of the "V". Minimum mark size 24px.
- The owner may replace the mark later; keep it behind one `<Logo />` component so it changes in one place.

## Do / Don't
- Do use accent gold on dark backgrounds; use `--text` on light backgrounds.
- Don't stretch, rotate, add shadows/gradients, or put the mark on busy photos.
