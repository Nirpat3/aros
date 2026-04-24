-- ═══════════════════════════════════════════════════════════════════════════
-- AROS Multi-Tenant Schema — Production (additive)
-- 2026-04-24
--
-- The prior bootstrap (db/supabase-schema.sql) already provisioned
-- tenants, tenant_members, pos_connections, edge_relays, onboarding_progress,
-- audit_log with RLS. This migration adds what's missing for real
-- multi-tenant UX: profiles, stores, and supplemental columns.
--
-- Safe to re-run: all statements are IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. profiles ────────────────────────────────────────────────────────────
-- Mirrors auth.users with public profile data. Filled by trigger on signup.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  is_superadmin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_superadmin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role') = 'superadmin', false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profile rows for any auth.users that predate the trigger
INSERT INTO public.profiles (id, email, full_name, is_superadmin)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  COALESCE((u.raw_user_meta_data->>'role') = 'superadmin', false)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ── 2. extend tenants ──────────────────────────────────────────────────────
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text;

UPDATE public.tenants SET timezone = 'America/New_York' WHERE timezone IS NULL;
UPDATE public.tenants SET currency = 'USD' WHERE currency IS NULL;
UPDATE public.tenants SET status = 'active' WHERE status IS NULL;

ALTER TABLE public.tenants ALTER COLUMN timezone SET DEFAULT 'America/New_York';
ALTER TABLE public.tenants ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.tenants ALTER COLUMN status SET DEFAULT 'active';

-- ── 3. extend tenant_members ───────────────────────────────────────────────
-- Original shape: id, tenant_id, user_id, role, invited_at, accepted_at
-- Add: is_default (for picker), status (active/invited/suspended), joined_at
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

-- Ensure only one default tenant per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_members_one_default
  ON public.tenant_members(user_id) WHERE is_default = true;

-- Backfill tenant_members from tenants.owner_id (legacy single-tenant data)
INSERT INTO public.tenant_members (tenant_id, user_id, role, is_default, status)
SELECT t.id, t.owner_id, 'owner', true, 'active'
FROM public.tenants t
WHERE t.owner_id IS NOT NULL
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- If a user has multiple memberships but no default, set the first as default
WITH users_needing_default AS (
  SELECT user_id
  FROM public.tenant_members
  WHERE status = 'active'
  GROUP BY user_id
  HAVING SUM(CASE WHEN is_default THEN 1 ELSE 0 END) = 0
),
first_membership AS (
  SELECT DISTINCT ON (tm.user_id) tm.id
  FROM public.tenant_members tm
  JOIN users_needing_default u ON u.user_id = tm.user_id
  WHERE tm.status = 'active'
  ORDER BY tm.user_id, tm.joined_at ASC, tm.id ASC
)
UPDATE public.tenant_members
SET is_default = true
WHERE id IN (SELECT id FROM first_membership);

-- ── 4. stores ──────────────────────────────────────────────────────────────
-- Physical locations. 1 tenant : N stores.
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  address text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  pos_provider text,
  pos_client_id text,
  pos_db_name text,
  pos_external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant ON public.stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_pos ON public.stores(pos_provider, pos_client_id);

-- ── 5. pos_connections — link to stores (optional) ─────────────────────────
-- Existing pos_connections is tenant-scoped. Add optional store_id for per-store configs.
ALTER TABLE public.pos_connections ADD COLUMN IF NOT EXISTS store_id uuid
  REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_connections_store
  ON public.pos_connections(store_id);

-- ── 6. Updated-at trigger helper (shared) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_profiles ON public.profiles;
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_stores ON public.stores;
CREATE TRIGGER touch_stores BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — additive policies for profiles + stores
-- (tenants, tenant_members, pos_connections already have RLS from the bootstrap)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT
  USING (id = auth.uid() OR is_superadmin);
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stores_select_member ON public.stores;
CREATE POLICY stores_select_member ON public.stores FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS stores_write_admin ON public.stores;
CREATE POLICY stores_write_admin ON public.stores FOR ALL
  USING (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  ) WITH CHECK (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
