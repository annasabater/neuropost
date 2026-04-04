/**
 * One-time script: promotes a user to superadmin.
 * Run with: npx ts-node --project tsconfig.json src/scripts/make-superadmin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL   ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? '';
const targetEmail    = process.env.ADMIN_EMAIL                ?? '';

if (!supabaseUrl || !serviceRoleKey || !targetEmail) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function makeSuperAdmin(email: string) {
  console.log(`Looking up user: ${email}...`);

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error('❌ Failed to list users:', listErr.message); process.exit(1); }

  const target = listData.users.find((u) => u.email === email);
  if (!target) { console.error(`❌ User not found: ${email}`); process.exit(1); }

  console.log(`Found user: ${target.id}`);

  // Upsert profile with superadmin role
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: target.id, role: 'superadmin' }, { onConflict: 'id' });

  if (error) { console.error('❌ Failed to update profile:', error.message); process.exit(1); }

  console.log(`✅ ${email} (${target.id}) is now superadmin`);
}

makeSuperAdmin(targetEmail).catch(console.error);
