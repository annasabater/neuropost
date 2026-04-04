// Note: We create untyped clients and cast results manually.
// This is intentional — the Database generic causes `never` inference
// with complex model types; explicit casts are safer here.
import {
  createBrowserClient as _createBrowserClient,
  createServerClient as _createServerClient,
} from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Brand, TeamRole } from '@/types';

const URL  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Client-side (use inside 'use client' components) ─────────────────────────
// persistSession + autoRefreshToken keep the user logged in for months without
// re-authentication, just like Notion / Gmail.
export function createBrowserClient() {
  return _createBrowserClient(URL(), ANON());
}

// ─── Server Component / Route Handler ─────────────────────────────────────────
export async function createServerClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return _createServerClient(URL(), ANON(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(_cookiesToSet) {
        // read-only in RSC — mutations handled by proxy.ts
      },
    },
  });
}

export const createRouteClient = createServerClient;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function getServerUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireServerUser() {
  const user = await getServerUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

// ─── Admin (service role) — bypass RLS for server-only operations ─────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Missing Supabase service role configuration');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getServerBrand(): Promise<Brand | null> {
  const user = await getServerUser();
  if (!user) return null;

  const supabase = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('brands')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (data as Brand | null);
}

/**
 * Resolves the brand and effective role for a user.
 * Supports both brand owners and team members.
 * Returns null if the user has no access to any brand.
 */
export async function getBrandAndRole(
  userId: string,
): Promise<{ brand: Brand; role: TeamRole } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createServerClient() as any;

  // 1. Try as owner first
  const { data: ownedBrand } = await supabase
    .from('brands')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (ownedBrand) return { brand: ownedBrand as Brand, role: 'admin' };

  // 2. Try as team member
  const { data: membership } = await supabase
    .from('team_members')
    .select('role, brands(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (membership?.brands) {
    return { brand: membership.brands as Brand, role: membership.role as TeamRole };
  }

  return null;
}
