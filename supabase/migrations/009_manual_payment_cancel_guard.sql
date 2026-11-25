-- Apply after 007_manual_payment_system.sql and 008_payment_proof_rls.sql.
-- Prevent receipt review from changing a cancelled or otherwise stale order.

create or replace function public.admin_confirm_manual_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := private.require_admin();
  o public.orders%rowtype;
begin
  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if o.payment_method <> 'MANUAL'
     or o.status <> 'PENDING_VERIFICATION'
     or o.payment_status <> 'under_review'
     or o.payment_proof_path is null then
    raise exception 'ORDER_ILLEGAL_TRANSITION';
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_verified_at = now(),
      payment_verified_by = uid,
      payment_rejection_reason = null,
      status = 'PAID'
  where id = p_order_id
    and status = 'PENDING_VERIFICATION'
    and payment_status = 'under_review';

  if not found then
    raise exception 'ORDER_STATUS_CHANGED';
  end if;

  insert into public.order_status_history(order_id, from_status, to_status, actor_id, actor_role)
  values (p_order_id, o.status, 'PAID', uid, 'ADMIN');

  insert into public.audit_log(actor_id, action, entity, entity_id, meta)
  values (uid, 'ORDER_PAYMENT_CONFIRMED', 'order', p_order_id,
          jsonb_build_object('payment_status', 'paid'));
end;
$$;

create or replace function public.admin_reject_manual_payment(
  p_order_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := private.require_admin();
  o public.orders%rowtype;
  clean_reason text;
begin
  clean_reason := regexp_replace(coalesce(trim(p_reason), ''), '[[:cntrl:]]+', ' ', 'g');
  if char_length(trim(clean_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if char_length(clean_reason) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if o.payment_method <> 'MANUAL'
     or o.status <> 'PENDING_VERIFICATION'
     or o.payment_status <> 'under_review'
     or o.payment_proof_path is null then
    raise exception 'ORDER_ILLEGAL_TRANSITION';
  end if;

  update public.orders
  set payment_status = 'rejected',
      payment_rejection_reason = trim(clean_reason),
      payment_verified_at = null,
      payment_verified_by = null
  where id = p_order_id
    and status = 'PENDING_VERIFICATION'
    and payment_status = 'under_review';

  if not found then
    raise exception 'ORDER_STATUS_CHANGED';
  end if;

  insert into public.audit_log(actor_id, action, entity, entity_id, meta)
  values (uid, 'ORDER_PAYMENT_REJECTED', 'order', p_order_id,
          jsonb_build_object('payment_status', 'rejected', 'reason', trim(clean_reason)));
end;
$$;

grant execute on function public.admin_confirm_manual_payment(uuid),
  public.admin_reject_manual_payment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
