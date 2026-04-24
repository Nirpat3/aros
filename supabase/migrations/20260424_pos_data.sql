-- ═══════════════════════════════════════════════════════════════════════════
-- AROS POS Data Schema — Production (additive)
-- 2026-04-24
--
-- Authoritative per-store POS data in Supabase. Sync workers (shre-rapidrms,
-- Verifone connector, etc.) write here; the AROS frontend reads via RLS.
-- Depends on 20260424_multi_tenant.sql (stores table).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── pos_sales_daily ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_sales_daily (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  department text,
  total_sales numeric(14,2) NOT NULL DEFAULT 0,
  total_transactions integer NOT NULL DEFAULT 0,
  total_units numeric(14,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(12,2) NOT NULL DEFAULT 0,
  total_tax numeric(14,2) NOT NULL DEFAULT 0,
  total_discounts numeric(14,2) NOT NULL DEFAULT 0,
  total_voids numeric(14,2) NOT NULL DEFAULT 0,
  total_refunds numeric(14,2) NOT NULL DEFAULT 0,
  source_provider text,
  source_sync_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, business_date, COALESCE(department, ''))
);

CREATE INDEX IF NOT EXISTS idx_pos_sales_daily_tenant_date
  ON public.pos_sales_daily(tenant_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_daily_store_date
  ON public.pos_sales_daily(store_id, business_date DESC);

-- ── pos_transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  transaction_time timestamptz NOT NULL,
  external_id text NOT NULL,
  cashier_id text,
  cashier_name text,
  register_id text,
  subtotal numeric(14,2),
  tax numeric(14,2),
  discount numeric(14,2),
  total numeric(14,2) NOT NULL,
  tender text,
  item_count integer,
  voided boolean NOT NULL DEFAULT false,
  refunded boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_tx_store_time
  ON public.pos_transactions(store_id, transaction_time DESC);
CREATE INDEX IF NOT EXISTS idx_pos_tx_tenant_date
  ON public.pos_transactions(tenant_id, business_date DESC);

-- ── pos_inventory_snapshot ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_inventory_snapshot (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text,
  department text,
  units_on_hand numeric(14,2),
  unit_cost numeric(12,4),
  unit_price numeric(12,4),
  inventory_value numeric(14,2),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  UNIQUE (store_id, sku, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_pos_inv_store_sku
  ON public.pos_inventory_snapshot(store_id, sku);

DROP TRIGGER IF EXISTS touch_pos_sales_daily ON public.pos_sales_daily;
CREATE TRIGGER touch_pos_sales_daily BEFORE UPDATE ON public.pos_sales_daily
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS — tenant membership gates all reads; writes are service_role only.
ALTER TABLE public.pos_sales_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psd_select_member ON public.pos_sales_daily;
CREATE POLICY psd_select_member ON public.pos_sales_daily FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ptx_select_member ON public.pos_transactions;
CREATE POLICY ptx_select_member ON public.pos_transactions FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

ALTER TABLE public.pos_inventory_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pis_select_member ON public.pos_inventory_snapshot;
CREATE POLICY pis_select_member ON public.pos_inventory_snapshot FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_owned_tenant_ids(auth.uid()))
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
  );

GRANT SELECT ON public.pos_sales_daily TO authenticated;
GRANT SELECT ON public.pos_transactions TO authenticated;
GRANT SELECT ON public.pos_inventory_snapshot TO authenticated;
