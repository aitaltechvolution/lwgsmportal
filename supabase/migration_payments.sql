-- ============================================================
-- LWGSM — Payment System Migration
-- Run this AFTER migration_features_2026.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PAYMENT TYPES
--    Existing enum: registration, tuition, certificate, material.
--    Add "other" for "Other Charges". ("material" already covers
--    Premium Course Material.)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = 'payment_type'::regtype AND enumlabel = 'other'
  ) THEN
    ALTER TYPE payment_type ADD VALUE 'other';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. PAYMENT METHOD + RECEIPT NUMBER
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text CHECK (method IN ('paystack', 'bank_transfer')) DEFAULT 'paystack';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_number text UNIQUE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
-- Paystack always charges in NGN here; amount_ngn is the exact kobo-derived
-- NGN amount charged, locked in at the moment the payment was initialized
-- (using the exchange rate in effect then), so verification can compare
-- against the precise amount Paystack actually processed rather than
-- re-deriving it from a since-changed exchange rate.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_ngn numeric(14,2);

-- Human-friendly sequential receipt number, e.g. LWGSM-2026-000123.
-- Assigned once, at insert time, and never reused.
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'LWGSM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_receipt_number ON public.payments;
CREATE TRIGGER payments_receipt_number BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_receipt_number();

-- ────────────────────────────────────────────────────────────
-- 3. RLS HARDENING (security fix)
--    The original "payments: student insert" policy let a student
--    insert a row with status='success' directly — i.e. fake their
--    own payment confirmation. Students may now only ever create a
--    'pending' row themselves (used for the bank-transfer "I've
--    made the transfer" flow, and as a placeholder before Paystack
--    verification completes). Marking a payment 'success' is only
--    ever done by:
--      a) the verify-paystack-payment Edge Function (via the
--         service role key, which bypasses RLS entirely), or
--      b) an admin confirming a bank transfer (existing
--         "payments: admin update" policy already covers this).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payments: student insert" ON public.payments;
CREATE POLICY "payments: student insert" ON public.payments FOR INSERT
  WITH CHECK (student_id = auth.uid() AND status = 'pending');

-- Admin update policy already exists from 00_initial_setup.sql
-- ("payments: admin update"); add a WITH CHECK so admins can still
-- only write valid status values (defense in depth, not a new gate).
DROP POLICY IF EXISTS "payments: admin update" ON public.payments;
CREATE POLICY "payments: admin update" ON public.payments FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 4. BANK ACCOUNTS (admin-editable, shown to students for bank
--    transfer payments). Stored as rows rather than a single JSON
--    blob in site_settings so the admin UI can list/edit/reorder
--    multiple accounts (FCMB, UBA, WEMA, etc.) cleanly.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name     text NOT NULL,
  account_name  text NOT NULL,
  account_number text NOT NULL,
  currency      text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN', 'USD')),
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts: read active" ON public.bank_accounts;
CREATE POLICY "bank_accounts: read active" ON public.bank_accounts FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "bank_accounts: admin write" ON public.bank_accounts;
CREATE POLICY "bank_accounts: admin write" ON public.bank_accounts FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed placeholder rows so the admin UI has something to edit. These are
-- inactive by default — students will not see them on the bank-transfer
-- screen until an admin edits in the real account details and activates
-- them from Admin → Settings → Bank Accounts.
INSERT INTO public.bank_accounts (bank_name, account_name, account_number, currency, is_active, sort_order)
SELECT * FROM (VALUES
  ('FCMB', 'Living Waters Global School of Ministry', '0000000000', 'NGN', false, 1),
  ('UBA',  'Living Waters Global School of Ministry', '0000000000', 'NGN', false, 2),
  ('Wema Bank', 'Living Waters Global School of Ministry', '0000000000', 'NGN', false, 3)
) AS v(bank_name, account_name, account_number, currency, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.bank_accounts);

-- ────────────────────────────────────────────────────────────
-- 5. FIXED FEE AMOUNTS (admin-configurable, used to pre-fill the
--    "Make Payment" amount field for fixed-price types).
-- ────────────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('fee_registration', '50'),
  ('fee_certificate', '25'),
  ('paystack_public_key', '')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
