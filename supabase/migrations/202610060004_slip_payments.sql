BEGIN;
CREATE TABLE public.slip_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expected_amount numeric(10,2) NOT NULL,
  promptpay_id varchar(13) NOT NULL,
  status text NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','FAILED','COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_slip_attempt_bill ON public.slip_verification_attempts(bill_id,created_at);
ALTER TABLE public.slip_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slip_verification_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.slip_verification_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_slip_verification(p_bill_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_promptpay text;
  v_attempt uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT b.* INTO v_bill FROM public.bills AS b JOIN public.properties AS p ON p.id = b.property_id
  WHERE b.id = p_bill_id AND p.user_id = v_user FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_bill.status = 'PAID' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF v_bill.status = 'DRAFT' THEN RAISE EXCEPTION 'BILL_NOT_ISSUED'; END IF;
  IF v_bill.slip_verify_count >= 3 THEN RAISE EXCEPTION 'SLIP_QUOTA_EXCEEDED'; END IF;
  IF EXISTS (SELECT 1 FROM public.slip_verification_attempts WHERE bill_id = p_bill_id
    AND status = 'RESERVED' AND created_at > now() - interval '30 seconds') THEN
    RAISE EXCEPTION 'VERIFICATION_IN_PROGRESS';
  END IF;
  SELECT promptpay_id INTO v_promptpay FROM public.properties WHERE id = v_bill.property_id;
  UPDATE public.bills SET slip_verify_count = slip_verify_count + 1, updated_at = clock_timestamp() WHERE id = p_bill_id;
  INSERT INTO public.slip_verification_attempts (bill_id,owner_id,expected_amount,promptpay_id)
  VALUES (p_bill_id,v_user,v_bill.total_amount,v_promptpay) RETURNING id INTO v_attempt;
  RETURN jsonb_build_object('attempt_id',v_attempt,'bill_id',p_bill_id,'property_id',v_bill.property_id,
    'owner_id',v_user,'expected_amount',v_bill.total_amount,'promptpay_id',v_promptpay,'remaining',2-v_bill.slip_verify_count);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_slip_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_slip_verification(uuid) TO authenticated;

-- Only trusted server code may turn a provider result into money received.
-- This RPC is never executable by an authenticated browser client.
CREATE OR REPLACE FUNCTION public.complete_slip_payment(
  p_attempt_id uuid, p_owner_id uuid, p_trans_ref text, p_amount numeric,
  p_transfer_date timestamptz, p_sender_bank text, p_receiver_account text, p_raw_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempt public.slip_verification_attempts%ROWTYPE;
  v_bill public.bills%ROWTYPE;
BEGIN
  -- Read attempt identity first, then lock bill before attempt, consistently
  -- with reservation/manual approval to prevent deadlocks.
  SELECT * INTO v_attempt FROM public.slip_verification_attempts WHERE id = p_attempt_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT b.* INTO v_bill FROM public.bills AS b JOIN public.properties AS p ON p.id = b.property_id
  WHERE b.id = v_attempt.bill_id AND p.user_id = p_owner_id FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_attempt FROM public.slip_verification_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_bill.status = 'PAID' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF v_attempt.status <> 'RESERVED' OR v_attempt.created_at < now() - interval '30 seconds' THEN RAISE EXCEPTION 'ATTEMPT_EXPIRED'; END IF;
  IF v_bill.status = 'DRAFT' THEN RAISE EXCEPTION 'BILL_NOT_ISSUED'; END IF;
  IF p_amount IS NULL OR p_amount <> v_attempt.expected_amount OR p_amount <> v_bill.total_amount THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  IF p_trans_ref IS NULL OR btrim(p_trans_ref) = '' OR length(p_trans_ref) > 100
    OR p_transfer_date IS NULL OR NOT isfinite(p_transfer_date) OR p_transfer_date > now() + interval '5 minutes'
    OR p_receiver_account IS NULL OR p_receiver_account !~ '^[0-9]{6,20}$'
    OR p_raw_payload IS NULL OR jsonb_typeof(p_raw_payload) <> 'object' THEN RAISE EXCEPTION 'INVALID_SLIP'; END IF;
  -- UNIQUE trans_ref is global. A 23505 rolls back both this insert and PAID.
  INSERT INTO public.slip_transactions (trans_ref,bill_id,verified_amount,transfer_date,sender_bank,receiver_account,raw_payload)
  VALUES (btrim(p_trans_ref),v_bill.id,p_amount,p_transfer_date,p_sender_bank,p_receiver_account,p_raw_payload);
  UPDATE public.bills SET status = 'PAID',payment_method = 'EASYSLIP',paid_at = now(),updated_at = clock_timestamp() WHERE id = v_bill.id;
  UPDATE public.slip_verification_attempts SET status = 'COMPLETED',completed_at = now() WHERE id = p_attempt_id;
  RETURN jsonb_build_object('remaining',3-v_bill.slip_verify_count);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_slip_payment(uuid,uuid,text,numeric,timestamptz,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_slip_payment(uuid,uuid,text,numeric,timestamptz,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_slip_verification(p_attempt_id uuid,p_owner_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.slip_verification_attempts SET status = 'FAILED',completed_at = now()
  WHERE id = p_attempt_id AND owner_id = p_owner_id AND status = 'RESERVED';
$$;
REVOKE ALL ON FUNCTION public.fail_slip_verification(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_slip_verification(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_bill_manual_paid(p_bill_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT b.* INTO v_bill FROM public.bills AS b JOIN public.properties AS p ON p.id = b.property_id
  WHERE b.id = p_bill_id AND p.user_id = auth.uid() FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_bill.status = 'PAID' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF v_bill.status = 'DRAFT' THEN RAISE EXCEPTION 'BILL_NOT_ISSUED'; END IF;
  UPDATE public.bills SET status = 'PAID',payment_method = 'MANUAL',paid_at = now(),updated_at = clock_timestamp() WHERE id = p_bill_id;
  UPDATE public.slip_verification_attempts SET status = 'FAILED',completed_at = now() WHERE bill_id = p_bill_id AND status = 'RESERVED';
  RETURN jsonb_build_object('remaining',3-v_bill.slip_verify_count);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_bill_manual_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_bill_manual_paid(uuid) TO authenticated;
COMMIT;
