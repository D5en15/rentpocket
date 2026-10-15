BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, phone_number)
  VALUES (NEW.id, COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''), NULLIF(split_part(NEW.email, '@', 1), ''), 'เจ้าของห้องเช่า'), NULLIF(NEW.phone, ''));
  INSERT INTO public.subscriptions(user_id, status, plan_name, max_rooms, trial_ends_at)
  VALUES (NEW.id, 'TRIAL_ACTIVE', 'Trial', 50, NEW.created_at + interval '14 days');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
COMMIT;
