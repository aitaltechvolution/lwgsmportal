-- supabase/migrations/006_certificate_payment_confirmed_trigger.sql
--
-- FIX: "Admin already confirmed payment, but the certificate is still
-- showing preview / fee not confirmed."
--
-- Root cause: admin/Certificates.tsx has a comment claiming "is_paid flips
-- automatically via the payments trigger once a certificate-collection
-- payment is confirmed" — but no such trigger exists anywhere in this
-- project's migrations. Confirming a payment in admin/Finance.tsx
-- (onConfirmPayment) only ever updates the `payments` row's own status;
-- nothing links that back to the certificate it was paying for, so
-- `certificates.is_paid` never changes and the student keeps seeing the
-- "PREVIEW / unpaid" state no matter how many times the payment is
-- confirmed.
--
-- There's no certificate_id column on `payments` (see the certificate
-- payment flow added in student/Payments.tsx), so the link between a
-- payment and its certificate is the `description` field, written as:
--   "Certificate collection — <certificate_number>"
-- This trigger parses that back out and flips is_paid the moment a
-- matching payment's status becomes 'success' — whether that happens via
-- an admin manually confirming a bank transfer, or a Paystack payment
-- being verified.
--
-- Run this once in the Supabase SQL editor.

create or replace function public.handle_certificate_payment_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert_number text;
begin
  if NEW.type = 'certificate' and NEW.status = 'success'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'success') then

    -- description is written as "Certificate collection — <number>";
    -- split_part on the em dash pulls out just the certificate number.
    v_cert_number := trim(split_part(coalesce(NEW.description, ''), '—', 2));

    if v_cert_number <> '' then
      update public.certificates
      set is_paid = true
      where student_id = NEW.student_id
        and certificate_number = v_cert_number
        and is_paid = false;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists payments_confirm_certificate on public.payments;
create trigger payments_confirm_certificate
  after insert or update on public.payments
  for each row
  execute function public.handle_certificate_payment_confirmed();

-- One-off backfill: fix any certificate payments that were already
-- confirmed before this trigger existed (like the one you just hit).
update public.certificates c
set is_paid = true
from public.payments p
where p.type = 'certificate'
  and p.status = 'success'
  and p.student_id = c.student_id
  and trim(split_part(coalesce(p.description, ''), '—', 2)) = c.certificate_number
  and c.is_paid = false;
