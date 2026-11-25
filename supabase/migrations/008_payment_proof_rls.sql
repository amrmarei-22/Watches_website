-- Idempotent RLS hardening for private payment receipt storage.

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'payment-proofs';

update storage.buckets set public = false where id = 'receipts';

drop policy if exists payment_proofs_insert_own on storage.objects;
drop policy if exists payment_proofs_update_own on storage.objects;
drop policy if exists payment_proofs_delete_own on storage.objects;
drop policy if exists payment_proofs_select_own on storage.objects;
drop policy if exists payment_proofs_select_admin on storage.objects;

drop policy if exists receipts_read_all on storage.objects;
drop policy if exists receipts_public_read on storage.objects;
drop policy if exists receipts_insert_own on storage.objects;
drop policy if exists receipts_delete_own on storage.objects;

create policy payment_proofs_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select o.id::text
    from public.orders o
    where o.user_id = auth.uid()
      and o.payment_method = 'MANUAL'
      and o.payment_status in ('awaiting_payment', 'rejected')
  )
);

create policy payment_proofs_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select o.id::text
    from public.orders o
    where o.user_id = auth.uid()
  )
);

create policy payment_proofs_select_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

create policy payment_proofs_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select o.id::text
    from public.orders o
    where o.user_id = auth.uid()
      and o.payment_status in ('awaiting_payment', 'rejected')
  )
);
