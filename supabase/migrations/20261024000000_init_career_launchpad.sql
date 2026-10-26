-- Career Launchpad Initial Schema Migration
-- Migration: 20261024000000_init_career_launchpad.sql

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Admin Profiles table
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Registrations table
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    normalized_phone TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    normalized_email TEXT UNIQUE NOT NULL,
    college_name TEXT NOT NULL,
    pass_out_year INTEGER NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL,
    ai_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    ticket_token_hash TEXT UNIQUE NOT NULL,
    email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
    attendance_status TEXT NOT NULL DEFAULT 'not_checked_in' CHECK (attendance_status IN ('not_checked_in', 'checked_in')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure department column exists if migrating existing table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '';

-- Indexes for performance & rapid lookup
CREATE INDEX IF NOT EXISTS idx_registrations_token_hash ON public.registrations(ticket_token_hash);
CREATE INDEX IF NOT EXISTS idx_registrations_reg_id ON public.registrations(registration_id);
CREATE INDEX IF NOT EXISTS idx_registrations_normalized_email ON public.registrations(normalized_email);
CREATE INDEX IF NOT EXISTS idx_registrations_normalized_phone ON public.registrations(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_registrations_attendance ON public.registrations(attendance_status);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON public.registrations(registered_at DESC);

-- 3. Email Delivery Jobs table
CREATE TABLE IF NOT EXISTS public.email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT NOT NULL REFERENCES public.registrations(registration_id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Google Sheets Integration Jobs table
CREATE TABLE IF NOT EXISTS public.integration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT NOT NULL REFERENCES public.registrations(registration_id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('insert_row', 'update_attendance')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_registration_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Helper Function: Is Active Admin (Hardened with search_path)
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- 7. Secure Duplicate Check Function (Returns ONLY booleans, never leaks participant records)
CREATE OR REPLACE FUNCTION public.check_registration_exists(
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_norm_email TEXT;
    v_norm_phone TEXT;
    v_exists_email BOOLEAN := false;
    v_exists_phone BOOLEAN := false;
BEGIN
    IF p_email IS NOT NULL AND p_email <> '' THEN
        v_norm_email := LOWER(TRIM(p_email));
        SELECT EXISTS(SELECT 1 FROM public.registrations WHERE normalized_email = v_norm_email) INTO v_exists_email;
    END IF;
    
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
        v_norm_phone := REGEXP_REPLACE(p_phone, '[^0-9+]', '', 'g');
        SELECT EXISTS(SELECT 1 FROM public.registrations WHERE normalized_phone = v_norm_phone) INTO v_exists_phone;
    END IF;

    RETURN jsonb_build_object(
        'email_exists', v_exists_email,
        'phone_exists', v_exists_phone
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_registration_exists(TEXT, TEXT) TO anon, authenticated;

-- 8. Atomic QR Code Ticket Check-in Function (Hardened with search_path, supports token or registration ID)
CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_token_hash TEXT DEFAULT NULL,
    p_registration_id TEXT DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reg RECORD;
    v_now TIMESTAMPTZ := now();
    v_caller_admin UUID;
BEGIN
    -- Determine admin ID from context or parameter
    v_caller_admin := COALESCE(auth.uid(), p_admin_id);

    -- Ensure active admin role is verified if admin ID is provided
    IF v_caller_admin IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = v_caller_admin AND is_active = true) THEN
            RETURN jsonb_build_object(
                'status', 'unauthorized',
                'message', 'Caller is not an active verified administrator.'
            );
        END IF;
    END IF;

    -- Atomically lock row for update to prevent concurrent race conditions
    IF p_token_hash IS NOT NULL AND p_token_hash <> '' THEN
        SELECT * INTO v_reg 
        FROM public.registrations 
        WHERE ticket_token_hash = p_token_hash 
        FOR UPDATE;
    ELSIF p_registration_id IS NOT NULL AND p_registration_id <> '' THEN
        SELECT * INTO v_reg 
        FROM public.registrations 
        WHERE LOWER(registration_id) = LOWER(TRIM(p_registration_id)) 
        FOR UPDATE;
    ELSE
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Either ticket token hash or registration ID must be provided.'
        );
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'not_found',
            'message', 'Invalid ticket token. No participant matches this code.'
        );
    END IF;

    IF v_reg.attendance_status = 'checked_in' THEN
        RETURN jsonb_build_object(
            'status', 'already_checked_in',
            'registration_id', v_reg.registration_id,
            'full_name', v_reg.full_name,
            'college_name', v_reg.college_name,
            'department', v_reg.department,
            'domain', v_reg.domain,
            'checked_in_at', v_reg.checked_in_at
        );
    END IF;

    -- Update attendance atomically
    UPDATE public.registrations
    SET attendance_status = 'checked_in',
        checked_in_at = v_now,
        checked_in_by = v_caller_admin
    WHERE id = v_reg.id;

    -- Queue Google Sheets sync job
    INSERT INTO public.integration_jobs (registration_id, job_type, status)
    VALUES (v_reg.registration_id, 'update_attendance', 'pending');

    -- Insert audit log
    INSERT INTO public.audit_logs (action, performed_by, target_registration_id, details)
    VALUES (
        'check_in', 
        v_caller_admin, 
        v_reg.registration_id, 
        jsonb_build_object('checked_in_at', v_now, 'method', 'qr_scan')
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'registration_id', v_reg.registration_id,
        'full_name', v_reg.full_name,
        'college_name', v_reg.college_name,
        'department', v_reg.department,
        'domain', v_reg.domain,
        'checked_in_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_participant(TEXT, TEXT, UUID) TO authenticated, service_role;

-- 9. Automatic Transactional Job Queue Trigger
CREATE OR REPLACE FUNCTION public.handle_new_registration_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Queue email delivery job
    INSERT INTO public.email_jobs (registration_id, recipient_email, status)
    VALUES (NEW.registration_id, NEW.normalized_email, 'pending');

    -- Queue Google Sheets sync job
    INSERT INTO public.integration_jobs (registration_id, job_type, status)
    VALUES (NEW.registration_id, 'insert_row', 'pending');

    -- Log registration event
    INSERT INTO public.audit_logs (action, target_registration_id, details)
    VALUES ('registration_created', NEW.registration_id, jsonb_build_object(
        'email', NEW.normalized_email,
        'created_at', NEW.registered_at
    ));

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_registration_jobs ON public.registrations;
CREATE TRIGGER trg_new_registration_jobs
    AFTER INSERT ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_registration_jobs();

-- 10. Row Level Security Policies
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin profiles: Admins can read their own profile
CREATE POLICY "Admins can view profiles"
    ON public.admin_profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_active_admin());

-- Registrations:
-- Public can submit new event registrations with strict anti-tampering constraint
DROP POLICY IF EXISTS "Public can register" ON public.registrations;
CREATE POLICY "Public can register"
    ON public.registrations FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        attendance_status = 'not_checked_in'
        AND checked_in_at IS NULL
        AND checked_in_by IS NULL
        AND email_status IN ('pending', 'sent')
    );

-- REMOVED: Insecure 'Public can check duplicates' policy that allowed full table scan by anon
DROP POLICY IF EXISTS "Public can check duplicates" ON public.registrations;

-- Only active authenticated admins can view registrations and update attendance
DROP POLICY IF EXISTS "Admins can view registrations" ON public.registrations;
CREATE POLICY "Admins can view registrations"
    ON public.registrations FOR SELECT
    TO authenticated
    USING (public.is_active_admin());

DROP POLICY IF EXISTS "Admins can update registrations" ON public.registrations;
CREATE POLICY "Admins can update registrations"
    ON public.registrations FOR UPDATE
    TO authenticated
    USING (public.is_active_admin())
    WITH CHECK (public.is_active_admin());

-- Email Jobs:
CREATE POLICY "Admins can view email jobs"
    ON public.email_jobs FOR SELECT
    TO authenticated
    USING (public.is_active_admin());

CREATE POLICY "Admins can update email jobs"
    ON public.email_jobs FOR UPDATE
    TO authenticated
    USING (public.is_active_admin());

-- Integration Jobs:
CREATE POLICY "Admins can view integration jobs"
    ON public.integration_jobs FOR SELECT
    TO authenticated
    USING (public.is_active_admin());

CREATE POLICY "Admins can update integration jobs"
    ON public.integration_jobs FOR UPDATE
    TO authenticated
    USING (public.is_active_admin());

-- Audit logs:
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_active_admin());
