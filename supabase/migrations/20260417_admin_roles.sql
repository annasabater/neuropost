-- ═══════════════════════════════════════════════════════════════════════════════
-- Admin role setup
-- Sets annasabater01@gmail.com and neuropost.team@gmail.com as admin
-- Role hierarchy: admin (full access) > worker (limited, no config/team mgmt)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_emails text[] := ARRAY['annasabater01@gmail.com', 'neuropost.team@gmail.com'];
  v_email  text;
  v_user_id uuid;
  v_full_name text;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
    INTO v_user_id, v_full_name
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE NOTICE 'User % not found — skipping (register first, then re-run).', v_email;
      CONTINUE;
    END IF;

    -- workers table (used by /api/worker/me)
    INSERT INTO workers (id, full_name, email, role, is_active, brands_assigned, specialties)
    VALUES (v_user_id, v_full_name, v_email, 'admin', true, '{}', '{content,community,management}')
    ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true, email = v_email;

    -- worker_profiles table (used by newer portal pages)
    INSERT INTO worker_profiles (user_id, display_name, email, role, department, is_active)
    VALUES (v_user_id, v_full_name, v_email, 'owner', 'management', true)
    ON CONFLICT (user_id) DO UPDATE SET role = 'owner', is_active = true, email = v_email;

    -- profiles table superadmin flag
    UPDATE profiles SET role = 'superadmin' WHERE id = v_user_id;

    RAISE NOTICE 'Admin role granted to % (id: %)', v_email, v_user_id;
  END LOOP;
END $$;

-- ─── Ensure admin-only pages are enforced via RLS hints ───────────────────────
-- The actual enforcement is in API routes via requireAdminWorker().
-- Workers with role='worker' or role='senior' are blocked by that check.
-- This comment documents the intended access matrix:
--
--   Page/Feature              admin   senior  worker  client
--   ─────────────────────     ──────  ──────  ──────  ──────
--   /worker (operations)        ✓       ✓       ✓       ✗
--   /worker/inbox               ✓       ✓       ✓       ✗
--   /worker/analytics           ✓       ✓       ✓       ✗
--   /worker/clientes            ✓       ✓       ✓       ✗
--   /worker/central             ✓       ✓       ✓       ✗
--   /worker/finanzas            ✓       ✗       ✗       ✗
--   /worker/auditoria           ✓       ✗       ✗       ✗
--   /worker/settings (team)     ✓       ✗       ✗       ✗
--   /worker/anuncios            ✓       ✓       ✗       ✗
--   Add/remove workers          ✓       ✗       ✗       ✗
--   Change worker roles         ✓       ✗       ✗       ✗
