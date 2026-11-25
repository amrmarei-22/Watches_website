# Manual Payment and Receipt Review

## Flow

1. Customers may select manual payment or cash on delivery at checkout.
2. Manual orders are created with `payment_status=awaiting_payment`.
3. The customer uploads a JPG, PNG or WebP receipt (maximum 5 MB).
4. The upload sets `payment_status=under_review` and order status `PENDING_VERIFICATION`.
5. An administrator confirms or rejects the receipt. Rejection opens a dialog with focus in the reason field; the reason must be 3–500 characters. Escape and Cancel close the dialog and return focus to the button that opened it.
6. Confirmation sets `payment_status=paid`, records the verifier and timestamp, and moves the order to `PAID`.
7. Rejection sets `payment_status=rejected`, stores the reason and allows a replacement upload.

## Storage

The `payment-proofs` bucket is private. Storage paths use `{order_id}/{timestamp}-{safe_filename}`.
Customers may access only receipts for their own orders. Administrators may access all receipts.
The app creates signed URLs for viewing, with a 60-minute expiry.
Migration `008_payment_proof_rls.sql` recreates these Storage policies idempotently.

## Configuration

Set these Vite environment variables locally and in Vercel:

- `VITE_PAYMENT_INSTAPAY_ADDRESS`
- `VITE_PAYMENT_WALLET_NUMBER`
- `VITE_WHATSAPP_NUMBER`

The shipping fee remains the documented flat `SHIPPING_FLAT_FEE`; there is no governorate fee table in this release.

## Database migration

Run `supabase/migrations/007_manual_payment_system.sql` once in a Supabase project after migrations 001-006.
Run `supabase/migrations/008_payment_proof_rls.sql` once after migration 007 to apply the hardened Storage RLS policies.
Run `supabase/migrations/009_manual_payment_cancel_guard.sql` after migration 008. It replaces the receipt review RPCs with checks that require a current `PENDING_VERIFICATION` manual order and prevent stale or cancelled orders from being confirmed or rejected.
Do not run migration 006 again after migration 007; migration 007 revokes broad direct order insert grants.

### Remote Supabase rollout and verification

In the Supabase Dashboard SQL Editor, check the columns and policy below first. If the payment columns are missing, run `007_manual_payment_system.sql`; if the admin Storage policy is missing, run `008_payment_proof_rls.sql`. Run `009_manual_payment_cancel_guard.sql` after both earlier migrations. Do not remove columns from frontend queries to work around a missing migration.

Verify the order columns:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'payment_status',
    'payment_proof_path',
    'payment_sender_info',
    'payment_rejection_reason',
    'payment_submitted_at',
    'payment_verified_at',
    'payment_verified_by'
  )
order by column_name;
```

Verify the admin receipt-read policy and the project's admin-role helper:

```sql
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'payment_proofs_select_admin';

select pg_get_functiondef('public.is_admin()'::regprocedure);
```

The policy must be for `SELECT`, constrain `bucket_id = 'payment-proofs'`, and call `public.is_admin()`. The helper must identify admins through `profiles.role = 'ADMIN'`.

Verify the guarded RPC definitions:

```sql
select pg_get_functiondef('public.admin_confirm_manual_payment(uuid)'::regprocedure);
select pg_get_functiondef('public.admin_reject_manual_payment(uuid,text)'::regprocedure);
```

After applying migration 009, refresh the PostgREST schema cache with:

```sql
notify pgrst, 'reload schema';
```

## Security

- Totals and shipping are recomputed by PostgreSQL RPC functions.
- Receipt uploads are limited to 5 MB and JPG/PNG/WebP.
- Customers may submit replacements only from `awaiting_payment` or `rejected`.
- Confirmation and rejection require the administrator role and a current payment status check. The RPCs also reject cancelled or stale orders.
- Shipping uses `app_settings.shipping_flat_fee` at order creation and stores the result in `orders.shipping_fee`; there is no `shipping_rates` table in this release.
