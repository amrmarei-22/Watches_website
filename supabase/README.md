<div align="center">

# Vintage — Luxury Watches Store
### فينتج — متجر الساعات الفاخرة

A bilingual (Arabic RTL / English LTR) e‑commerce website for luxury watches, built with React and Supabase.
متجر إلكتروني ثنائي اللغة (عربي RTL / إنجليزي LTR) لبيع الساعات الفاخرة، مبني بـ React و Supabase.

[English](#english) · [العربية](#العربية)

</div>

<!--
  Add screenshots here after you take them (save the images in docs/screenshots/):
  ![Home](docs/screenshots/home.png)
  ![Shop](docs/screenshots/shop.png)
  ![Checkout](docs/screenshots/checkout.png)
  ![Admin](docs/screenshots/admin.png)
-->

---

## English

### What is this?
Vintage is an online watch store for the Egyptian market. Visitors browse and search watches, customers register, check out with **cash on delivery** and track their orders, and an admin manages products, stock, orders and users from a separate dashboard.

The project is **spec‑driven**: every business rule, state and flow is written in [`docs/`](docs/) first, and the code implements those documents. Nothing is left for the code (or an AI assistant) to guess.

### Features
**Storefront**
- Arabic (default, RTL) and English (LTR) with a language switch; every text comes from locale files
- Catalog with search (Arabic‑aware), filters (brand, price, gender, movement, material, in‑stock), sorting and pagination; state is kept in the URL
- Product pages with gallery, specs, and stock‑aware availability ("Only 2 left", "Out of stock")
- Cart for guests (stored in the browser) and customers (stored on the server), merged on login, revalidated for price and stock changes
- Checkout in 3 steps (Address → Review → Done), cash on delivery, safe against double submits
- Customer account: profile, saved addresses (max 5), order history, cancel while the order is still pending
- Dark, premium design system with scroll and hover motion that respects `prefers-reduced-motion`

**Admin dashboard** (`/admin`)
- Products: create, edit, publish / unpublish / archive, feature, bilingual content, image upload
- Inventory: set or adjust stock with a reason; every change is logged
- Orders: full status workflow with only the legal actions shown, cancellation with a required reason (stock is restored automatically), internal notes
- Users: enable / disable accounts
- Audit trail of important actions

### Tech stack
| Area | Technology |
|------|------------|
| Frontend | Vite, React, TypeScript (strict) |
| Styling | Tailwind CSS v4 with design tokens (CSS variables) |
| Routing | React Router (`/ar/*`, `/en/*`) |
| Data | Supabase (PostgreSQL, Auth, Storage), TanStack Query |
| Forms | React Hook Form + Zod |
| i18n | i18next + react‑i18next |
| Motion | motion, GSAP (ScrollTrigger), Lenis |
| Icons | lucide‑react |
| Tests | Vitest |

### Security model
There is **no custom backend server**. Protection lives in the database:
- **Row Level Security** limits who can read what (customers only see their own data, drafts are hidden from the public).
- Stock, order status, roles and carts can be changed **only through SQL functions (RPC)**, never by direct table writes.
- Placing an order is a single transaction that locks the products, so two people buying the last unit at the same time cannot both succeed.
- The browser only uses the Supabase **anon (publishable)** key. **Never** put the `service_role` key in the frontend or in Git.

### Business rules at a glance
- Currency: **EGP**, stored as integer piasters. Payment: **cash on delivery** only (v1).
- Low stock: 3 units or fewer (configurable per product). Max 3 units of a product per cart line.
- Stock is deducted when the order is created and restored if it is cancelled.
- Customers must verify their email before placing an order.
- Order lifecycle (no backward steps):

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   │          │            │
   └──────────┴────────────┴──► CANCELLED
```

Full details: [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md), [`docs/ORDER_STATES.md`](docs/ORDER_STATES.md), [`docs/PRODUCT_STATES.md`](docs/PRODUCT_STATES.md).

### Getting started

**Requirements:** Node.js 20+ and a free [Supabase](https://supabase.com) account.

**1. Clone and install**
```bash
git clone https://github.com/amrmarei-22/Watches_website.git
cd Watches_website
npm install
```

**2. Create the Supabase project**
1. In Supabase, create a new project and save the database password.
2. Open **SQL Editor** and run the full content of [`supabase/setup_all.sql`](supabase/setup_all.sql) once (do not also run the files in `supabase/migrations/`).
3. *(Development only)* run [`supabase/seed.sql`](supabase/seed.sql) to add 8 sample watches.
4. **Authentication → Providers → Email:** keep "Confirm email" enabled.
5. **Authentication → URL Configuration:** set the Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to the redirect URLs.

**3. Add your keys**
Create `.env.local` in the project root (it is git‑ignored):
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

**4. Run**
```bash
npm run dev
```
Open the URL printed in the terminal (usually `http://localhost:5173`).

**5. Create an admin**
Register a normal account in the app and confirm its email, then run in the Supabase SQL Editor:
```sql
update public.profiles set role = 'ADMIN'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```
Admins log in at `/en/admin/login` (or `/ar/admin/login`). Use a different account from the one you shop with.

**6. Set the shipping fee (optional)**
Amounts are in piasters, e.g. 5000 = 50 EGP:
```sql
update public.app_settings set shipping_flat_fee = 5000 where id = 1;
```

### Scripts
| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the development server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run the unit tests (Vitest) |
| `npm run build` | Production build into `dist/` |

### Project structure
```
.
├── .github/
│   ├── copilot-instructions.md   Rules for the AI assistant (read the docs, never invent behavior)
│   └── prompts/                  Installed design skills
├── docs/                         Specification: the single source of truth
├── supabase/
│   ├── migrations/               Database: tables, RLS, functions (001 → 003)
│   ├── setup_all.sql             The three migrations in one file
│   └── seed.sql                  Sample data (development only)
├── public/                       Logo, placeholder images
└── src/
    ├── app/                      Router, providers, layouts
    ├── config/                   businessConfig.ts (all business constants)
    ├── domain/                   Pure business logic: inventory, order state machine, permissions, money
    ├── features/                 catalog, cart, checkout, orders, account, auth, admin
    ├── components/               Reusable UI components
    ├── motion/                   Animation presets and hooks
    ├── locales/                  ar.json, en.json
    └── lib/                      Supabase client, i18n setup
```

### Documentation
| File | Purpose |
|------|---------|
| [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) | Scope, roles, data model, pages |
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | All rules and constants |
| [`docs/PRODUCT_STATES.md`](docs/PRODUCT_STATES.md) / [`ORDER_STATES.md`](docs/ORDER_STATES.md) | Lifecycles and allowed transitions |
| [`docs/USER_FLOW.md`](docs/USER_FLOW.md) / [`ADMIN_FLOW.md`](docs/ADMIN_FLOW.md) | Storefront and admin flows |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Every table and function the frontend may call |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | Architecture, database, localization rules |
| [`docs/DESIGN.md`](docs/DESIGN.md) / [`BRAND.md`](docs/BRAND.md) | Design system, motion, brand |
| [`docs/HOME_AND_CHROME.md`](docs/HOME_AND_CHROME.md) | Header, footer, home page, static pages |
| [`docs/UI_STATES.md`](docs/UI_STATES.md) / [`docs/i18n/`](docs/i18n/) | Loading/empty/error states and all messages (AR + EN) |
| [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) | Decisions still waiting for the owner |

### Contributing
1. Read the relevant files in `docs/` before changing anything.
2. If something is not specified, **ask or update the docs first**. Do not invent behavior.
3. Business logic goes in `src/domain/` with tests; never hard‑code constants (use `businessConfig.ts`) or user‑facing text (use the locale files, always in both languages).
4. Database changes go in a **new numbered migration file**; never edit one that has already been applied.
5. Before opening a pull request run `npm run typecheck`, `npm test` and `npm run build`.

### Deploying
Any static host works (Vercel, Netlify, Cloudflare Pages):
- Build command `npm run build`, output directory `dist`.
- Add the two `VITE_SUPABASE_*` environment variables on the host.
- Enable the **single‑page‑app fallback** (all routes → `index.html`), otherwise refreshing `/en/shop` returns a 404.
- Add the production URL to Supabase **Authentication → URL Configuration**.

**Before going live**
- [ ] Use a clean Supabase project (or remove sample products and test orders)
- [ ] Add real products and photos (see below)
- [ ] Set up custom SMTP for emails (the default Supabase mailer is heavily rate‑limited)
- [ ] Set the shipping fee and fill the contact details in `businessConfig.ts`
- [ ] Fill and legally review the privacy, terms and shipping pages
- [ ] Review the Arabic text listed in `src/locales/NEEDS_REVIEW.md`

### Product photos
Photos are uploaded from the admin dashboard (**Products → edit → Images**), which stores them in the `product-images` Storage bucket and records them in the database. Use your own photos of the actual watches: vertical **4:5**, at least 1600 px wide, JPG / PNG / WebP, under 5 MB each, up to 8 per product. Do not copy photos from other websites.

### Status and roadmap
**Working:** catalog, product pages, cart, checkout, orders, authentication, admin dashboard, bilingual RTL layout.
**In progress:** visual polish, scroll animations, static pages content.
**Not in v1:** online card payments, returns/refunds, discount coupons, reviews, wishlist, email/SMS notifications, social login, admin sub‑roles.

### License
Not specified yet. Until a license is added, all rights are reserved by the owner.

---

## العربية

### ما هذا المشروع؟
**فينتج (Vintage)** متجر إلكتروني لبيع الساعات الفاخرة في السوق المصري. الزائر يتصفح ويبحث، والعميل يسجّل ويطلب بالدفع عند الاستلام ويتابع طلباته، والأدمن يدير المنتجات والمخزون والطلبات والمستخدمين من لوحة تحكم منفصلة.

المشروع مبني على **مواصفات مكتوبة مسبقًا**: كل قاعدة وحالة ومسار موجودين في مجلد [`docs/`](docs/)، والكود ينفّذها كما هي دون تخمين.

### أهم المميزات
- واجهة بالعربية (RTL، الافتراضية) والإنجليزية مع زر تبديل اللغة
- بحث وفلاتر وفرز للساعات، وحالة التوفر (متوفر / كمية محدودة / نفدت الكمية)
- سلة للزائر وللعميل المسجّل، مع التحقق من السعر والمخزون
- إتمام الطلب في ٣ خطوات بالدفع عند الاستلام، مع حماية من تكرار الطلب
- حساب العميل: البيانات والعناوين وسجل الطلبات وإلغاء الطلب قبل تأكيده
- لوحة أدمن: المنتجات والصور والمخزون والطلبات والمستخدمين وسجل العمليات

### التشغيل السريع
1. نزّل المشروع وثبّت الحزم: `npm install`
2. أنشئ مشروعًا على [Supabase](https://supabase.com) وشغّل ملف `supabase/setup_all.sql` في **SQL Editor** مرة واحدة، ثم `supabase/seed.sql` للبيانات التجريبية فقط
3. أنشئ ملف `.env.local` وضع فيه `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` (لا ترفعه على GitHub أبدًا، ولا تستخدم مفتاح `service_role` في الواجهة)
4. شغّل `npm run dev`
5. لتحويل حسابك إلى أدمن: سجّل حسابًا عاديًا وأكّد بريدك، ثم نفّذ أمر SQL الموضح في قسم **Create an admin** أعلاه

### قبل الإطلاق
استخدم مشروع Supabase نظيفًا، وأضف المنتجات والصور الحقيقية، وفعّل خدمة بريد SMTP، وحدّد سعر الشحن وبيانات التواصل، وراجع الصفحات القانونية والنصوص العربية.

### للمطوّرين
اقرأ ملفات `docs/` قبل أي تعديل. وإذا كان هناك شيء غير موضّح فاسأل أو حدّث المواصفات أولًا بدل افتراضه. وأي تغيير في قاعدة البيانات يكون بملف migration جديد.