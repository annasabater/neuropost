-- ============================================================================
-- NeuroPost — Phase 6: social-account quota + grandfathering
--
-- Every plan now includes 1 connected social platform. Extra platforms are
-- a paid add-on (+€15/mo each). This migration:
--
--   1. Adds brands.purchased_extra_accounts (int, default 0)
--   2. Grandfathers: for every brand currently connected to more than 1
--      platform, sets purchased_extra_accounts = (connected - 1) so the
--      rule applies without anyone losing access. When they cancel the
--      add-on, the quota is enforced then.
--   3. Adds an index on the column for the quota-check query path.
--
-- Safe to re-run — uses IF NOT EXISTS / upsert idempotently. The grandfather
-- step only fires on rows that still have purchased_extra_accounts = 0 to
-- avoid overwriting values set by the Stripe webhook afterwards.
-- ============================================================================

BEGIN;

-- 1. Column
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS purchased_extra_accounts int NOT NULL DEFAULT 0
    CHECK (purchased_extra_accounts >= 0);

COMMENT ON COLUMN public.brands.purchased_extra_accounts IS
  'Number of extra social-account connections the brand has paid for '
  'on top of the one bundled with every plan. Synced from the Stripe '
  'subscription items (+€15/mo per add-on). Grandfathered to the '
  'connected count at the time of the phase-6 migration.';

-- 2. Grandfather existing connections. Skip rows where the column already
--    carries a non-default value (means Stripe already synced an addon).
WITH connected_counts AS (
  SELECT brand_id, count(*)::int AS n
  FROM public.platform_connections
  WHERE status = 'active'
  GROUP BY brand_id
)
UPDATE public.brands b
SET purchased_extra_accounts = GREATEST(cc.n - 1, 0)
FROM connected_counts cc
WHERE b.id = cc.brand_id
  AND b.purchased_extra_accounts = 0
  AND cc.n > 1;

-- 3. Index — the quota-check query reads (brand_id, purchased_extra_accounts)
--    but there's only going to be one row per brand, so a targeted index
--    on the brands table by id is already the primary key. No extra index
--    needed. We DO want one on platform_connections to count fast:
CREATE INDEX IF NOT EXISTS idx_platform_connections_brand_active_count
  ON public.platform_connections (brand_id)
  WHERE status = 'active';

COMMIT;

-- Sanity: how many brands got grandfathered a > 0 addon count
DO $$
DECLARE
  n_gf int;
BEGIN
  SELECT count(*) INTO n_gf FROM public.brands WHERE purchased_extra_accounts > 0;
  RAISE NOTICE 'Brands grandfathered with > 0 extra accounts: %', n_gf;
END $$;
