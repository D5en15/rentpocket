BEGIN;
CREATE OR REPLACE FUNCTION public.fn_guard_room_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_subscription public.subscriptions%ROWTYPE;
  v_current_rooms bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.property_id = OLD.property_id THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO v_user_id FROM public.properties AS p WHERE p.id = NEW.property_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;

  -- RLS still checks the invoking user's INSERT/UPDATE. Definer privileges
  -- are limited to obtaining the subscription lock and counting all rooms.
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT s.* INTO v_subscription FROM public.subscriptions AS s
  WHERE s.user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;

  IF v_subscription.trial_ends_at < now()
     OR v_subscription.current_period_end < now() THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED';
  END IF;
  IF v_subscription.status NOT IN ('TRIAL_ACTIVE', 'ACTIVE') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED';
  END IF;
  IF (v_subscription.status = 'TRIAL_ACTIVE' AND v_subscription.trial_ends_at IS NULL)
     OR (v_subscription.status = 'ACTIVE' AND v_subscription.current_period_end IS NULL) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_EXPIRED';
  END IF;

  SELECT count(*) INTO v_current_rooms FROM public.rooms AS r
  JOIN public.properties AS p ON p.id = r.property_id
  WHERE p.user_id = v_user_id AND r.id <> NEW.id;
  IF v_current_rooms >= v_subscription.max_rooms THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED' USING DETAIL = format('Maximum rooms: %s', v_subscription.max_rooms);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_guard_room_quota() FROM PUBLIC, anon, authenticated, service_role;
-- Trigger functions cannot be called as RPCs. Runtime trigger execution does
-- not require granting EXECUTE to the inserting role; postgres owns the trigger.
GRANT EXECUTE ON FUNCTION public.fn_guard_room_quota() TO postgres;
DROP TRIGGER IF EXISTS tr_guard_room_quota ON public.rooms;
CREATE TRIGGER tr_guard_room_quota BEFORE INSERT OR UPDATE OF property_id ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_room_quota();
COMMIT;
