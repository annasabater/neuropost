// =============================================================================
// NEUROPOST — RBAC (Role-Based Access Control)
// Checks team member roles before allowing API operations.
//
// Roles:
//   admin    → full access (same as brand owner)
//   editor   → create/edit posts, generate content
//   approver → approve/reject posts only
//   analyst  → read-only: analytics, reports
// =============================================================================

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { TeamRole } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ─── Permission matrix ────────────────────────────────────────────────────────

const PERMISSIONS: Record<string, TeamRole[]> = {
  // Content creation & editing
  create_post:    ['admin', 'editor'],
  edit_post:      ['admin', 'editor'],
  delete_post:    ['admin'],
  generate_ideas: ['admin', 'editor'],
  generate_image: ['admin', 'editor'],
  generate_video: ['admin', 'editor'],
  edit_image:     ['admin', 'editor'],
  schedule_post:  ['admin', 'editor'],

  // Approval workflow
  approve_post:   ['admin', 'approver'],
  reject_post:    ['admin', 'approver'],
  publish_post:   ['admin'],

  // Analytics & reports
  view_analytics: ['admin', 'analyst', 'editor', 'approver'],
  view_report:    ['admin', 'analyst', 'editor', 'approver'],

  // Settings & team (admin only)
  manage_brand:   ['admin'],
  manage_team:    ['admin'],
  manage_billing: ['admin'],
  connect_social: ['admin'],
};

// ─── Core check ───────────────────────────────────────────────────────────────

/**
 * Returns the effective role for a user in a brand.
 * Brand owners (user_id === brand.user_id) are treated as 'admin'.
 * Returns null if the user has no access to the brand.
 */
export async function getUserRoleForBrand(
  userId: string,
  brandId: string,
): Promise<TeamRole | null> {
  const supabase = await createServerClient() as DB;

  // Check if user is the brand owner
  const { data: brand } = await supabase
    .from('brands')
    .select('user_id')
    .eq('id', brandId)
    .single();

  if (brand?.user_id === userId) return 'admin';

  // Check team_members table
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return (member?.role as TeamRole) ?? null;
}

/**
 * Checks if a user has permission to perform an action on a brand.
 * Returns a 403 NextResponse if not, or null if allowed.
 */
export async function requirePermission(
  userId: string,
  brandId: string,
  action: string,
): Promise<NextResponse | null> {
  const role = await getUserRoleForBrand(userId, brandId);

  if (!role) {
    return NextResponse.json({ error: 'No tienes acceso a esta marca' }, { status: 403 });
  }

  const allowed = PERMISSIONS[action];
  if (allowed && !allowed.includes(role)) {
    return NextResponse.json(
      { error: `Tu rol (${role}) no tiene permiso para: ${action}` },
      { status: 403 },
    );
  }

  return null;
}
