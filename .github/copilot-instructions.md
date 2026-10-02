# Copilot Instructions — Luxury Watches Store

You are implementing a product that is **already specified**. You do not design behavior; you implement it.

## 0. Golden rules
1. **The `docs/` folder is the single source of truth.** Read the relevant docs BEFORE writing any code:
   - `docs/PROJECT_SPEC.md` — scope, roles, glossary, constants
   - `docs/BUSINESS_RULES.md` — all rules and numeric constants
   - `docs/PRODUCT_STATES.md` — product lifecycle + stock-derived availability
   - `docs/ORDER_STATES.md` — order lifecycle + allowed transitions
   - `docs/USER_FLOW.md` — storefront flows
   - `docs/ADMIN_FLOW.md` — admin flows
   - `docs/UI_STATES.md` — loading / empty / error states and messages
   - `docs/OPEN_DECISIONS.md` — items not yet confirmed by the owner
   - `docs/API.md` — the COMPLETE list of backend calls, error codes and table rules (do not call anything else)
   - `supabase/migrations/*.sql` — the real database schema, RLS and RPC functions (read-only for you: never edit applied migrations; propose a new numbered migration and ask)
   - `docs/API_CONTRACT.md` — every table/RPC the frontend may call and its errors
   - `docs/TECH_STACK.md` — stack, database, RPC, RLS, folder layout, localization rules
   - `docs/DESIGN.md` — colors, typography, layout, motion system
   - `docs/BRAND.md` — name, logo, brand constants
   - `supabase/migrations/*.sql` — the finished database/API (read-only for you; see TECH_STACK §9)
   - `docs/i18n/en.json`, `docs/i18n/ar.json` — all message keys and labels (Arabic + English)
2. **Never invent behavior.** If something is not in the docs, or is listed in `OPEN_DECISIONS.md` as OPEN, STOP and ASK the owner. Do not guess, do not pick a "reasonable default" silently.
3. **Do not add features** not in the spec (no wishlists, coupons, reviews, returns, multi-currency, etc. unless the docs say so). See "Out of scope" in `PROJECT_SPEC.md`.
4. **If code and docs disagree, the docs win.** If you believe a doc is wrong, say so and ask; do not "fix" it in code.
5. **Every task ends with a traceability note:** list which doc sections (e.g. `BUSINESS_RULES §4.2`) the change implements.

## 1. Single source of truth in code
- All numeric/business constants live in ONE file: `src/config/businessConfig.ts` (values from `BUSINESS_RULES.md §0`). Never hard-code `5`, `3`, `0`, etc. inline.
- Stock logic lives in ONE module: `src/domain/inventory.ts`, exposing `getAvailability(product)`, `canAddToCart(product, qty)`, etc. UI and API must call these. **Never write `stock === 0`, `stock < 1`, or `stock <= 5` anywhere else.**
- Order status transitions live in ONE module: `src/domain/orderStateMachine.ts`, built from the transition table in `ORDER_STATES.md`. Any status change must go through it.
- Permission checks live in ONE module: `src/domain/permissions.ts`, built from `BUSINESS_RULES.md §2`.
- Enums/types for statuses are defined once (`src/domain/types.ts`) and imported everywhere. No string literals like `"pending"` in components.

## 2. Server is the authority (= Supabase RLS + SQL functions, see TECH_STACK §2)
- Every rule (stock, price, permissions, status transitions, totals) is enforced **on the server**. Client checks are only UX hints.
- Never trust prices, totals, stock, or user role sent from the client. Recompute server-side.
- Money is stored and computed as **integers in minor units** (piasters). Format only at display time.

## 3. Required behavior for every feature you build
- Implement ALL states in `UI_STATES.md`: loading, empty, error, success, disabled. A screen without them is incomplete.
- Use the exact user-facing messages from `docs/i18n/*.json` (copied to `src/locales/`). Do not rephrase or invent messages.
- **No hard-coded strings.** Every label/message is an i18n key present in BOTH `ar.json` and `en.json`. Layout uses CSS logical properties (RTL-safe). New Arabic text must be flagged "needs owner review".
- Validate on client AND server using the same schema (shared validation module).
- Accessibility: keyboard navigable, visible focus, labels on inputs, `aria-live` for errors, alt text on images.
- No silent failures: every failed request shows the defined error state.

## 4. Code quality
- TypeScript strict mode. No `any`.
- Small components; no business logic in components.
- Write tests for: inventory rules, order state machine, permissions, cart totals. Tests are derived from the docs' tables (each row = at least one test case).
- Do not install new dependencies without asking.

## 5. Workflow for each task
1. Restate the task in one sentence and list the doc sections that govern it.
2. List any ambiguities / OPEN decisions that block it. If any → ask, wait.
3. Implement.
4. List tests added and the traceability note.

## 6. Forbidden
- Inventing roles, statuses, transitions, fields, endpoints, or messages.
- Hard-coding secrets, using localStorage for auth tokens, logging personal data.
- Hard-deleting products or orders (see `BUSINESS_RULES.md §9`).
- Changing a status by writing directly to the DB column.

## 7. Skills, MCP tools and libraries (installed by the owner)
- Design/UI skills (e.g. ui-ux-pro-max), component tools (21st MCP) and animation libraries are **for visual implementation only**: layout, typography, color, components, motion.
- **Precedence:** `docs/` (business rules, states, flows, messages) ALWAYS wins over any skill suggestion. A skill may never add pages, features, fields, statuses, flows or change copy defined in `docs/UI_STATES.md`.
- Do NOT install packages, skills, or MCP servers yourself. If one is needed, tell the owner the exact command and wait.
- Before any visual work, ask the owner for `docs/DESIGN.md` (palette, typography, mood, motion level) if it doesn't exist. Do not let a skill pick the brand identity silently.
- Respect `prefers-reduced-motion` for all animation. Animation must never block interaction or hide required states (loading/error/empty).

## 8. Backend usage rules
- Use ONLY the tables/RPCs listed in `docs/API.md`. If you need something else, stop and ask for a new migration.
- Business errors arrive as `error.message === CODE` (see API.md §1). Map every code to its i18n key; never display raw error text.
- Brand name/logo come from `src/config/brand.ts` and `public/brand/`; sample images from `public/placeholders/`.
- Never put the service_role/secret key anywhere. Frontend env vars are only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
