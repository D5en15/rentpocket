BEGIN;

-- Freeze rates and comparison units per cycle so room setting changes cannot
-- silently change a bill while the owner is entering readings.
ALTER TABLE public.bills
  ADD COLUMN electric_rate numeric(10,2),
  ADD COLUMN water_rate numeric(10,2),
  ADD COLUMN water_billing_type public.water_billing_type,
  ADD COLUMN previous_electric_units numeric(10,2);
UPDATE public.bills AS b SET electric_rate = r.electric_rate,
  water_rate = r.water_rate, water_billing_type = r.water_billing_type
FROM public.rooms AS r WHERE r.id = b.room_id;
ALTER TABLE public.bills
  ALTER COLUMN electric_rate SET NOT NULL,
  ALTER COLUMN water_rate SET NOT NULL,
  ALTER COLUMN water_billing_type SET NOT NULL,
  ADD CONSTRAINT chk_bill_rates CHECK (electric_rate >= 0 AND water_rate >= 0),
  ADD CONSTRAINT chk_previous_electric_units CHECK (previous_electric_units >= 0);

-- Read through RLS; issue bills only through authenticated, validated RPCs.
DROP POLICY IF EXISTS "Users can manage bills in own properties" ON public.bills;
CREATE POLICY "Users can read bills in own properties" ON public.bills
FOR SELECT TO authenticated USING (public.is_property_owner(property_id));
REVOKE INSERT, UPDATE, DELETE ON public.bills FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_billing_cycle(p_property_id uuid, p_cycle text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sub public.subscriptions%ROWTYPE;
  v_expired boolean;
  v_previous text;
  v_due date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    OR substring(p_cycle,1,4)::integer NOT BETWEEN 1900 AND 9998 THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;
  v_expired := v_sub.status NOT IN ('TRIAL_ACTIVE', 'ACTIVE')
    OR COALESCE(v_sub.trial_ends_at < now(), false)
    OR COALESCE(v_sub.current_period_end < now(), false)
    OR (v_sub.status = 'TRIAL_ACTIVE' AND v_sub.trial_ends_at IS NULL)
    OR (v_sub.status = 'ACTIVE' AND v_sub.current_period_end IS NULL);
  v_previous := to_char(to_date(p_cycle || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM');
  v_due := (to_date(p_cycle || '-01', 'YYYY-MM-DD') + interval '1 month 4 days')::date;
  IF NOT v_expired THEN
    INSERT INTO public.bills (property_id, room_id, billing_cycle,
      prev_electric_meter, curr_electric_meter, prev_water_meter, curr_water_meter,
      base_rent, total_amount, due_date, electric_rate, water_rate, water_billing_type, previous_electric_units)
    SELECT r.property_id, r.id, p_cycle,
      COALESCE(prev.curr_electric_meter, 0), COALESCE(prev.curr_electric_meter, 0),
      COALESCE(prev.curr_water_meter, 0), COALESCE(prev.curr_water_meter, 0),
      r.base_rent, r.base_rent, v_due, r.electric_rate, r.water_rate, r.water_billing_type, prev.electric_units
    FROM public.rooms AS r
    LEFT JOIN public.bills AS prev ON prev.room_id = r.id AND prev.billing_cycle = v_previous AND prev.status <> 'DRAFT'
    WHERE r.property_id = p_property_id
    ON CONFLICT (room_id, billing_cycle) DO NOTHING;

    -- A previous month's bill may have been completed after this draft opened.
    -- Refresh only untouched drafts; issued bills remain immutable here.
    WITH baselines AS (
      SELECT b.id, COALESCE(prev.curr_electric_meter,0) AS electric,
        COALESCE(prev.curr_water_meter,0) AS water, prev.electric_units AS units
      FROM public.bills AS b LEFT JOIN public.bills AS prev
        ON prev.room_id = b.room_id AND prev.billing_cycle = v_previous AND prev.status <> 'DRAFT'
      WHERE b.property_id = p_property_id AND b.billing_cycle = p_cycle AND b.status = 'DRAFT'
    )
    UPDATE public.bills AS b SET prev_electric_meter = s.electric, curr_electric_meter = s.electric,
      prev_water_meter = s.water, curr_water_meter = s.water, previous_electric_units = s.units, updated_at = clock_timestamp()
    FROM baselines AS s WHERE b.id = s.id AND
      (b.prev_electric_meter IS DISTINCT FROM s.electric OR b.prev_water_meter IS DISTINCT FROM s.water
       OR b.previous_electric_units IS DISTINCT FROM s.units);
  END IF;
  RETURN jsonb_build_object(
    'expired', v_expired,
    'rooms', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.room_number) FROM public.rooms AS r WHERE r.property_id = p_property_id), '[]'::jsonb),
    'bills', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.room_id) FROM public.bills AS b WHERE b.property_id = p_property_id AND b.billing_cycle = p_cycle), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_billing_cycle(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_billing_cycle(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_meter_readings(p_readings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sub public.subscriptions%ROWTYPE;
  v_item jsonb;
  v_bill public.bills%ROWTYPE;
  v_prev public.bills%ROWTYPE;
  v_current numeric;
  v_water numeric;
  v_carry numeric;
  v_other numeric;
  v_units numeric;
  v_water_units numeric;
  v_electric_amount numeric;
  v_water_amount numeric;
  v_total numeric;
  v_rollover boolean;
  v_replaced boolean;
  v_warning boolean;
  v_room_number text;
  v_due date;
  v_changes jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_change jsonb;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_readings IS NULL OR jsonb_typeof(p_readings) <> 'array' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  v_count := jsonb_array_length(p_readings);
  IF v_count NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF (SELECT count(DISTINCT e->>'billId') FROM jsonb_array_elements(p_readings) AS e) <> v_count THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;
  IF v_sub.status NOT IN ('TRIAL_ACTIVE', 'ACTIVE')
    OR v_sub.trial_ends_at < now() OR v_sub.current_period_end < now()
    OR (v_sub.status = 'TRIAL_ACTIVE' AND v_sub.trial_ends_at IS NULL)
    OR (v_sub.status = 'ACTIVE' AND v_sub.current_period_end IS NULL) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED';
  END IF;

  -- Stable locking order avoids deadlocks between concurrent batch requests.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_readings) ORDER BY value->>'billId' LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR COALESCE(v_item->>'billId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR COALESCE(v_item->>'currentElectric','') !~ '^[0-9]{1,8}([.,][0-9]{1,2})?$'
      OR COALESCE(v_item->>'otherFees','') !~ '^[0-9]{1,8}([.,][0-9]{1,2})?$'
      OR COALESCE(jsonb_typeof(v_item->'isRollover'),'null') <> 'boolean'
      OR COALESCE(jsonb_typeof(v_item->'isReplaced'),'null') <> 'boolean'
      OR COALESCE(jsonb_typeof(v_item->'confirmWarning'),'null') <> 'boolean'
      OR COALESCE(v_item->>'expectedUpdatedAt','') = ''
      OR COALESCE(v_item->>'dueDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    SELECT b.* INTO v_bill FROM public.bills AS b
    JOIN public.properties AS p ON p.id = b.property_id
    JOIN public.rooms AS r ON r.id = b.room_id AND r.property_id = b.property_id
    WHERE b.id = (v_item->>'billId')::uuid AND p.user_id = v_user FOR UPDATE OF b;
    IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF v_bill.status <> 'DRAFT' THEN RAISE EXCEPTION 'BILL_LOCKED'; END IF;
    IF v_bill.updated_at <> (v_item->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'STALE_READING'; END IF;
    IF EXISTS (SELECT 1 FROM public.bills WHERE room_id = v_bill.room_id AND billing_cycle > v_bill.billing_cycle AND status <> 'DRAFT') THEN
      RAISE EXCEPTION 'BILL_LOCKED';
    END IF;
    SELECT * INTO v_prev FROM public.bills
    WHERE room_id = v_bill.room_id
      AND billing_cycle = to_char(to_date(v_bill.billing_cycle || '-01','YYYY-MM-DD') - interval '1 month','YYYY-MM')
      AND status <> 'DRAFT';
    IF v_bill.prev_electric_meter IS DISTINCT FROM COALESCE(v_prev.curr_electric_meter,0)
      OR v_bill.prev_water_meter IS DISTINCT FROM COALESCE(v_prev.curr_water_meter,0)
      OR v_bill.previous_electric_units IS DISTINCT FROM v_prev.electric_units THEN
      RAISE EXCEPTION 'STALE_READING';
    END IF;
    v_rollover := (v_item->>'isRollover')::boolean;
    v_replaced := (v_item->>'isReplaced')::boolean;
    IF v_rollover AND v_replaced THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    v_current := replace(v_item->>'currentElectric',',','.')::numeric;
    v_other := replace(v_item->>'otherFees',',','.')::numeric;
    v_carry := 0;
    IF v_replaced THEN
      IF COALESCE(v_item->>'carryUnits','') !~ '^-?[0-9]{1,8}([.,][0-9]{1,2})?$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
      v_carry := replace(v_item->>'carryUnits',',','.')::numeric;
    END IF;
    IF v_rollover AND (v_current >= 10000 OR v_bill.prev_electric_meter >= 10000) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    v_units := CASE WHEN v_replaced THEN v_carry + v_current
      WHEN v_rollover THEN (10000 - v_bill.prev_electric_meter) + v_current
      ELSE v_current - v_bill.prev_electric_meter END;
    IF v_units < 0 THEN RAISE EXCEPTION 'METER_DECREASED'; END IF;
    v_water := COALESCE(v_bill.prev_water_meter,0);
    v_water_units := 0;
    IF v_bill.water_billing_type = 'PER_UNIT' THEN
      IF COALESCE(v_item->>'currentWater','') !~ '^[0-9]{1,8}([.,][0-9]{1,2})?$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
      v_water := replace(v_item->>'currentWater',',','.')::numeric;
      v_water_units := v_water - COALESCE(v_bill.prev_water_meter,0);
      IF v_water_units < 0 THEN RAISE EXCEPTION 'METER_DECREASED'; END IF;
    END IF;
    v_electric_amount := round(v_units * v_bill.electric_rate,2);
    v_water_amount := CASE WHEN v_bill.water_billing_type = 'FLAT_RATE' THEN v_bill.water_rate ELSE round(v_water_units * v_bill.water_rate,2) END;
    v_total := v_bill.base_rent + v_other + v_electric_amount + v_water_amount;
    IF greatest(v_total,v_units,v_water_units,v_electric_amount,v_water_amount) > 99999999.99 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    v_due := (v_item->>'dueDate')::date;
    v_warning := v_units > 500 OR COALESCE(v_units > v_bill.previous_electric_units * 3,false);
    SELECT room_number INTO v_room_number FROM public.rooms WHERE id = v_bill.room_id;
    IF v_warning AND NOT (v_item->>'confirmWarning')::boolean THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'billId',v_bill.id,'roomNumber',v_room_number,'electricUnits',v_units,'waterUnits',v_water_units,
        'electricAmount',v_electric_amount,'waterAmount',v_water_amount,'baseRent',v_bill.base_rent,
        'otherFees',v_other,'totalAmount',v_total,'previousElectricUnits',v_bill.previous_electric_units,'softWarning',true));
    END IF;
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'id',v_bill.id,'current',v_current,'water',v_water,'carry',v_carry,'other',v_other,
      'units',v_units,'water_units',v_water_units,'electric_amount',v_electric_amount,
      'water_amount',v_water_amount,'total',v_total,'rollover',v_rollover,'replaced',v_replaced,'due',v_due));
  END LOOP;
  IF jsonb_array_length(v_warnings) > 0 THEN
    RETURN jsonb_build_object('ok',false,'code','SOFT_WARNING','message','หน่วยไฟสูงผิดปกติ กรุณาตรวจสอบก่อนออกบิล','warnings',v_warnings);
  END IF;
  FOR v_change IN SELECT value FROM jsonb_array_elements(v_changes) LOOP
    UPDATE public.bills SET curr_electric_meter = (v_change->>'current')::numeric,
      curr_water_meter = (v_change->>'water')::numeric,
      electric_units = (v_change->>'units')::numeric, water_units = (v_change->>'water_units')::numeric,
      electric_amount = (v_change->>'electric_amount')::numeric, water_amount = (v_change->>'water_amount')::numeric,
      other_fees = (v_change->>'other')::numeric, total_amount = (v_change->>'total')::numeric,
      is_meter_rollover = (v_change->>'rollover')::boolean,
      meter_rollover_max = CASE WHEN (v_change->>'rollover')::boolean THEN 10000 ELSE NULL END,
      is_meter_replaced = (v_change->>'replaced')::boolean, replaced_meter_carry_units = (v_change->>'carry')::numeric,
      due_date = (v_change->>'due')::date, status = 'PENDING_PAYMENT', updated_at = clock_timestamp()
    WHERE id = (v_change->>'id')::uuid;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('saved',v_count));
END;
$$;
REVOKE ALL ON FUNCTION public.save_meter_readings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meter_readings(jsonb) TO authenticated;
COMMIT;
