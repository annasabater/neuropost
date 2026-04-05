#!/usr/bin/env ts-node
// Usage: npx ts-node src/scripts/make-worker.ts <email> [role]
// Adds a user to the workers table, making them a NeuroPost worker.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.argv[2];
  const role  = (process.argv[3] ?? 'worker') as 'worker' | 'senior' | 'admin';

  if (!email) {
    console.error('Usage: make-worker <email> [worker|senior|admin]');
    process.exit(1);
  }

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  const user = users.find((u) => u.email === email);
  if (!user) {
    console.error(`User with email "${email}" not found in auth.users`);
    process.exit(1);
  }

  const { error } = await supabase.from('workers').upsert({
    id:        user.id,
    full_name: user.user_metadata?.full_name ?? email.split('@')[0],
    email:     email,
    role:      role,
    is_active: true,
  }, { onConflict: 'id' });

  if (error) throw error;

  console.log(`✅ Worker created: ${email} (role: ${role}, id: ${user.id})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
