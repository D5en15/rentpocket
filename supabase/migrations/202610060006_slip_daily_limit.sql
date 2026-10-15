BEGIN;
-- Fixed daily quota: 15 reserved verifications/property/Bangkok calendar day.
CREATE TABLE public.slip_daily_usage (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  verify_day date NOT NULL,
  verify_count integer NOT NULL CHECK (verify_count BETWEEN 1 AND 15),
  PRIMARY KEY (property_id,verify_day)
);
ALTER TABLE public.slip_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slip_daily_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.slip_daily_usage TO service_role;

-- Count existing reservations too, including failed/expired attempts. Cap the
-- stored value so properties already over the new limit are immediately blocked.
INSERT INTO public.slip_daily_usage(property_id,verify_day,verify_count)
SELECT b.property_id,(a.created_at AT TIME ZONE 'Asia/Bangkok')::date,
  LEAST(count(*),15)::integer
FROM public.slip_verification_attempts AS a
JOIN public.bills AS b ON b.id = a.bill_id
GROUP BY b.property_id,(a.created_at AT TIME ZONE 'Asia/Bangkok')::date;

CREATE OR REPLACE FUNCTION public.reserve_slip_verification(p_bill_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_promptpay text;
  v_attempt uuid;
  v_day date;
  v_daily_count integer;
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
  -- A single conditional UPSERT serializes concurrent reservations across all
  -- bills of this property. Charge before the provider call; failures/timeouts
  -- remain charged and rejected reservations roll back without using bill quota.
  v_day := (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date;
  INSERT INTO public.slip_daily_usage AS usage (property_id,verify_day,verify_count)
  VALUES (v_bill.property_id,v_day,1)
  ON CONFLICT (property_id,verify_day) DO UPDATE
    SET verify_count = usage.verify_count + 1
    WHERE usage.verify_count < 15
  RETURNING verify_count INTO v_daily_count;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DAILY_VERIFY_LIMIT_EXCEEDED';
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

COMMIT;
