-- ═══════════════════════════════════════════════════════════════════════════════
-- Grant worker access to annasabater01@gmail.com
-- Run this AFTER the user has registered/logged in at least once
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id uuid;
  v_full_name text;
BEGIN
  -- Find the user by email
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_user_id, v_full_name
  FROM auth.users
  WHERE email = 'annasabater01@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User annasabater01@gmail.com not found. Register first, then re-run this script.';
    RETURN;
  END IF;

  -- Insert into workers table (legacy table used by existing /api/worker/me)
  INSERT INTO workers (id, full_name, email, role, is_active, brands_assigned, specialties)
  VALUES (
    v_user_id,
    COALESCE(v_full_name, 'Anna Sabater'),
    'annasabater01@gmail.com',
    'admin',
    true,
    '{}',
    '{content,community,management}'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    email = 'annasabater01@gmail.com';

  -- Also insert into worker_profiles (new table for the new portal pages)
  INSERT INTO worker_profiles (user_id, display_name, email, role, department, is_active)
  VALUES (
    v_user_id,
    COALESCE(v_full_name, 'Anna Sabater'),
    'annasabater01@gmail.com',
    'owner',
    'management',
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'owner',
    is_active = true,
    email = 'annasabater01@gmail.com';

  -- Mark profile as superadmin too (existing profiles table has 'role')
  UPDATE profiles SET role = 'superadmin' WHERE id = v_user_id;

  RAISE NOTICE 'Worker access granted to annasabater01@gmail.com (id: %)', v_user_id;
END $$;
