-- ========================================================
-- RentPocket Production Database Schema (PostgreSQL 15+)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE subscription_status AS ENUM ('TRIAL_ACTIVE', 'ACTIVE', 'PAST_DUE', 'TRIAL_EXPIRED');
CREATE TYPE water_billing_type AS ENUM ('PER_UNIT', 'FLAT_RATE');
CREATE TYPE bill_status AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'OVERDUE');
CREATE TYPE payment_method AS ENUM ('EASYSLIP', 'MANUAL');
CREATE TYPE room_status AS ENUM ('VACANT', 'OCCUPIED');

-- Tables
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    status subscription_status NOT NULL DEFAULT 'TRIAL_ACTIVE',
    plan_name VARCHAR(50) NOT NULL DEFAULT 'Trial',
    max_rooms INT NOT NULL DEFAULT 50 CHECK (max_rooms > 0 AND max_rooms <= 100),
    trial_ends_at TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    promptpay_id VARCHAR(13) NOT NULL,
    promptpay_name VARCHAR(255) NOT NULL,
    default_electric_rate NUMERIC(10, 2) NOT NULL DEFAULT 8.00 CHECK (default_electric_rate >= 0),
    default_water_rate NUMERIC(10, 2) NOT NULL DEFAULT 18.00 CHECK (default_water_rate >= 0),
    default_water_type water_billing_type NOT NULL DEFAULT 'PER_UNIT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_promptpay_format CHECK (promptpay_id ~ '^[0-9]{10}$' OR promptpay_id ~ '^[0-9]{13}$')
);

CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor INT DEFAULT 1,
    base_rent NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (base_rent >= 0),
    electric_rate NUMERIC(10, 2) NOT NULL CHECK (electric_rate >= 0),
    water_billing_type water_billing_type NOT NULL DEFAULT 'PER_UNIT',
    water_rate NUMERIC(10, 2) NOT NULL CHECK (water_rate >= 0),
    status room_status NOT NULL DEFAULT 'OCCUPIED',
    tenant_name VARCHAR(255),
    tenant_phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_property_room_number UNIQUE (property_id, room_number)
);

CREATE TABLE public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    billing_cycle VARCHAR(7) NOT NULL, -- YYYY-MM
    prev_electric_meter NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (prev_electric_meter >= 0),
    curr_electric_meter NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (curr_electric_meter >= 0),
    electric_units NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (electric_units >= 0),
    electric_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (electric_amount >= 0),
    prev_water_meter NUMERIC(10, 2) DEFAULT 0.00 CHECK (prev_water_meter >= 0),
    curr_water_meter NUMERIC(10, 2) DEFAULT 0.00 CHECK (curr_water_meter >= 0),
    water_units NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (water_units >= 0),
    water_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (water_amount >= 0),
    base_rent NUMERIC(10, 2) NOT NULL CHECK (base_rent >= 0),
    other_fees NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (other_fees >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status bill_status NOT NULL DEFAULT 'DRAFT',
    due_date DATE NOT NULL,
    slip_verify_count INT NOT NULL DEFAULT 0 CHECK (slip_verify_count >= 0 AND slip_verify_count <= 3),
    payment_method payment_method,
    paid_at TIMESTAMPTZ,
    is_meter_rollover BOOLEAN NOT NULL DEFAULT FALSE,
    meter_rollover_max NUMERIC(10, 2) DEFAULT NULL,
    is_meter_replaced BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_meter_carry_units NUMERIC(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_room_billing_cycle UNIQUE (room_id, billing_cycle)
);

CREATE TABLE public.slip_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trans_ref VARCHAR(100) NOT NULL,
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE RESTRICT,
    verified_amount NUMERIC(10, 2) NOT NULL,
    transfer_date TIMESTAMPTZ NOT NULL,
    sender_bank VARCHAR(50),
    receiver_account VARCHAR(50),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_slip_trans_ref UNIQUE (trans_ref) -- ป้องกันสลิปซ้ำระดับ Global
);

-- Indexes
CREATE INDEX idx_properties_user_id ON public.properties(user_id);
CREATE INDEX idx_rooms_property_id ON public.rooms(property_id);
CREATE INDEX idx_bills_room_id ON public.bills(room_id);
CREATE INDEX idx_slip_transactions_bill_id ON public.slip_transactions(bill_id);
CREATE INDEX idx_bills_property_cycle ON public.bills(property_id, billing_cycle);
CREATE INDEX idx_bills_property_status ON public.bills(property_id, status);
CREATE INDEX idx_bills_overdue_lookup ON public.bills(property_id, due_date) WHERE status = 'PENDING_PAYMENT';

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slip_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_property_owner(p_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id AND user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can read own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own properties" ON public.properties FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage rooms in own properties" ON public.rooms FOR ALL USING (public.is_property_owner(property_id));
CREATE POLICY "Users can manage bills in own properties" ON public.bills FOR ALL USING (public.is_property_owner(property_id));
CREATE POLICY "Users can view slips of own properties" ON public.slip_transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.bills b
        JOIN public.properties p ON b.property_id = p.id
        WHERE b.id = slip_transactions.bill_id AND p.user_id = auth.uid()
    )
);

-- Anti-Concurrency Room Quota Trigger
CREATE OR REPLACE FUNCTION public.fn_guard_room_quota()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_max_rooms INT;
    v_current_rooms INT;
    v_sub_status subscription_status;
BEGIN
    SELECT user_id INTO v_user_id FROM public.properties WHERE id = NEW.property_id;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Property not found.'; END IF;

    SELECT max_rooms, status INTO v_max_rooms, v_sub_status
    FROM public.subscriptions WHERE user_id = v_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription profile not found.'; END IF;
    IF v_sub_status NOT IN ('TRIAL_ACTIVE', 'ACTIVE') THEN
        RAISE EXCEPTION 'CANNOT_ADD_ROOM: Subscription is inactive or expired.';
    END IF;

    SELECT COUNT(r.id) INTO v_current_rooms
    FROM public.rooms r JOIN public.properties p ON r.property_id = p.id WHERE p.user_id = v_user_id;

    IF v_current_rooms >= v_max_rooms THEN
        RAISE EXCEPTION 'QUOTA_EXCEEDED: Maximum room limit of % reached for current plan', v_max_rooms;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_guard_room_quota
    BEFORE INSERT ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_guard_room_quota();