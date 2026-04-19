// =============================================================================
// NEUROPOST — Resolve the email recipient for a given brand.
// Reads from auth.users via the brand's user_id.
// brands table has no direct email column (confirmed from schema).
// =============================================================================

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface BrandRecipient {
  email:      string;
  brand_name: string;
  user_id:    string;
}

/**
 * Returns the owner's email for a brand, reading from auth.users.
 * Returns null and logs if the brand or user cannot be found.
 */
export async function resolveBrandRecipient(brandId: string): Promise<BrandRecipient | null> {
  const db = getAdminClient();

  const { data: brand, error: brandErr } = await db
    .from('brands')
    .select('id, name, user_id')
    .eq('id', brandId)
    .single();

  if (brandErr || !brand) {
    console.error('[email] Brand no encontrada:', brandId, brandErr);
    return null;
  }

  const { data: result, error: userErr } = await db.auth.admin.getUserById(brand.user_id);

  if (userErr || !result?.user?.email) {
    console.error('[email] Email del owner no encontrado para user_id:', brand.user_id, userErr);
    return null;
  }

  return {
    email:      result.user.email,
    brand_name: brand.name,
    user_id:    brand.user_id,
  };
}
