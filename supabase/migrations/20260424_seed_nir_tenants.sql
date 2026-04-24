-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: Nir's 2 RapidRMS tenants — Party Liquor + RapidLab
-- Depends on: 20260424_multi_tenant.sql
-- Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE
-- ═══════════════════════════════════════════════════════════════════════════

-- Backfill profile for rapidnir (auth.users row already exists)
INSERT INTO public.profiles (id, email, full_name, is_superadmin)
SELECT id, email,
       COALESCE(raw_user_meta_data->>'full_name', email),
       COALESCE((raw_user_meta_data->>'role') = 'superadmin', false)
FROM auth.users
WHERE email IN ('rapidnir@nirtek.net', 'qatest777@test.nirtek.net')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      is_superadmin = EXCLUDED.is_superadmin OR public.profiles.is_superadmin;

-- Party Liquor tenant
WITH nir AS (SELECT id FROM auth.users WHERE email = 'rapidnir@nirtek.net' LIMIT 1),
pl AS (
  INSERT INTO public.tenants (
    name, slug, owner_id, plan, billing_status, pos_system,
    store_count, license_tier, onboarding_completed, timezone, currency, status
  )
  SELECT 'Party Liquor', 'party-liquor', nir.id, 'pro', 'none', 'rapidrms',
         1, 'pro', true, 'America/New_York', 'USD', 'active'
  FROM nir
  ON CONFLICT (slug) DO UPDATE
    SET pos_system = EXCLUDED.pos_system,
        onboarding_completed = true,
        status = 'active'
  RETURNING id
)
INSERT INTO public.tenant_members (tenant_id, user_id, role, is_default, status)
SELECT pl.id, nir.id, 'owner', true, 'active'
FROM pl, nir
ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'owner', is_default = true, status = 'active';

-- RapidLab tenant
WITH nir AS (SELECT id FROM auth.users WHERE email = 'rapidnir@nirtek.net' LIMIT 1),
rl AS (
  INSERT INTO public.tenants (
    name, slug, owner_id, plan, billing_status, pos_system,
    store_count, license_tier, onboarding_completed, timezone, currency, status
  )
  SELECT 'RapidLab', 'rapidlab', nir.id, 'pro', 'none', 'rapidrms',
         1, 'pro', true, 'America/New_York', 'USD', 'active'
  FROM nir
  ON CONFLICT (slug) DO UPDATE
    SET pos_system = EXCLUDED.pos_system,
        onboarding_completed = true,
        status = 'active'
  RETURNING id
)
INSERT INTO public.tenant_members (tenant_id, user_id, role, is_default, status)
SELECT rl.id, nir.id, 'owner', false, 'active'
FROM rl, nir
ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = 'owner', status = 'active';

-- Stores — one per tenant (1:1 initially; tenants may add more stores later)
INSERT INTO public.stores (
  tenant_id, name, slug, timezone, currency, status,
  pos_provider, pos_client_id, pos_db_name
)
SELECT t.id, 'Party Liquor — Main', 'main', 'America/New_York', 'USD', 'active',
       'rapidrms', '2', 'RapidRMS2'
FROM public.tenants t
WHERE t.slug = 'party-liquor'
ON CONFLICT (tenant_id, slug) DO UPDATE
  SET pos_provider = EXCLUDED.pos_provider,
      pos_client_id = EXCLUDED.pos_client_id,
      pos_db_name = EXCLUDED.pos_db_name;

INSERT INTO public.stores (
  tenant_id, name, slug, timezone, currency, status,
  pos_provider, pos_client_id, pos_db_name
)
SELECT t.id, 'RapidLab — QA', 'main', 'America/New_York', 'USD', 'active',
       'rapidrms', 'rapidlab', 'rapidlab'
FROM public.tenants t
WHERE t.slug = 'rapidlab'
ON CONFLICT (tenant_id, slug) DO UPDATE
  SET pos_provider = EXCLUDED.pos_provider,
      pos_client_id = EXCLUDED.pos_client_id,
      pos_db_name = EXCLUDED.pos_db_name;

-- POS connections — use the existing schema shape (tenant_id, connector_id, config, status)
INSERT INTO public.pos_connections (
  tenant_id, store_id, connector_id, config, status
)
SELECT t.id, s.id, 'rapidrms', '{"client_id":"2"}'::jsonb, 'connected'
FROM public.tenants t
JOIN public.stores s ON s.tenant_id = t.id AND s.slug = 'main'
WHERE t.slug = 'party-liquor'
ON CONFLICT DO NOTHING;

INSERT INTO public.pos_connections (
  tenant_id, store_id, connector_id, config, status
)
SELECT t.id, s.id, 'rapidrms', '{"client_id":"rapidlab"}'::jsonb, 'connected'
FROM public.tenants t
JOIN public.stores s ON s.tenant_id = t.id AND s.slug = 'main'
WHERE t.slug = 'rapidlab'
ON CONFLICT DO NOTHING;
