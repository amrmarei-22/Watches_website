# Supabase setup (10 minutes)

1. https://supabase.com → **New project** (choose the closest region, set a strong DB password and save it).
2. **SQL Editor** → run, in order, each file's full content: `001_schema.sql`, `002_functions.sql`, `003_security.sql` (or just run `setup_all.sql` once).
3. Run `seed.sql` (sample products — development only).
4. **Authentication → Providers → Email**: keep "Confirm email" ON. (Dev: built-in email is rate-limited; for production add custom SMTP.)
5. **Authentication → URL Configuration**: Site URL = `http://localhost:5173` (add the production URL later).
6. **Project Settings → API**: copy *Project URL* and the *anon / publishable* key → `.env.local`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
   Never put the `service_role` key in the frontend.
7. Create your admin: sign up normally in the app (or Dashboard → Authentication → Add user), then run in SQL Editor:
   ```sql
   update public.profiles set role = 'ADMIN'
   where id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
8. Set shipping fee when decided (minor units, e.g. 5000 = 50 EGP):
   ```sql
   update public.app_settings set shipping_flat_fee = 5000 where id = 1;
   ```
Verified: these files were executed against PostgreSQL 16 with Supabase-style `auth`/`storage` stubs and tested for: RLS visibility, blocked direct writes, order placement, idempotency, last-unit race (parallel), price-change rejection, cancellation + stock restore, full order state machine, admin permissions.
Not verified: the Supabase-hosted environment itself (run step 2 and tell us about any error).
