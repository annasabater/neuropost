// ─────────────────────────────────────────────────────────────────────────────
//  Social-account quota — every plan includes 1 connected platform. Users
//  pay €15/mo per extra platform (tracked on brands.purchased_extra_accounts,
//  synced from Stripe). This module is the single source of truth for
//  "can this brand connect another platform right now?".
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase';
import type { Platform } from '@/lib/platforms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/** Every plan includes exactly one social account — parametric to make a
 *  future "Pro includes 2" tweak a single-line change. */
export const SOCIAL_ACCOUNTS_INCLUDED = 1;

export interface QuotaState {
  /** Slots shipped with the plan — always 1 today. */
  included:      number;
  /** Extra slots the brand has paid for via the Stripe add-on. */
  purchased:     number;
  /** Total platforms this brand is allowed to have connected. */
  limit:         number;
  /** Currently active platform_connections rows. */
  current:       number;
  /** limit - current, floored at 0. */
  remaining:     number;
  /** Platforms the brand already has active. */
  connected:     Platform[];
}

/**
 * Loads the current quota state for a brand. O(2) queries — one to read
 * `purchased_extra_accounts`, one to count + list active connections.
 */
export async function getSocialQuota(brandId: string): Promise<QuotaState> {
  const db = createAdminClient() as DB;

  const [{ data: brand }, { data: conns }] = await Promise.all([
    db.from('brands').select('purchased_extra_accounts').eq('id', brandId).single(),
    db.from('platform_connections')
      .select('platform')
      .eq('brand_id', brandId)
      .eq('status', 'active'),
  ]);

  const purchased = Number(brand?.purchased_extra_accounts ?? 0);
  const included  = SOCIAL_ACCOUNTS_INCLUDED;
  const limit     = included + purchased;
  const connected = ((conns ?? []) as Array<{ platform: Platform }>).map(c => c.platform);
  const current   = connected.length;
  const remaining = Math.max(0, limit - current);

  return { included, purchased, limit, current, remaining, connected };
}

export interface ConnectDecision {
  allowed: boolean;
  /** Present only when allowed === false. */
  reason?: string;
  /** Machine-readable code for the UI to render the right upsell / modal. */
  code?:   'over_quota' | 'already_connected';
  quota:   QuotaState;
}

/**
 * Called right before we persist a new platform_connections row. Returns
 * allowed=false when the brand already has the platform wired (normal
 * reconnect: we treat the existing row as a re-auth and allow it) — OR
 * when they're at their limit and the platform is new.
 */
export async function canConnectPlatform(
  brandId:  string,
  platform: Platform,
): Promise<ConnectDecision> {
  const quota = await getSocialQuota(brandId);

  // Re-connecting a platform the brand already has wired: always OK —
  // that's a token refresh / re-auth, no new quota slot is consumed.
  if (quota.connected.includes(platform)) {
    return { allowed: true, quota };
  }

  if (quota.current >= quota.limit) {
    return {
      allowed: false,
      code:    'over_quota',
      reason:  `Tu plan permite ${quota.limit} cuenta${quota.limit === 1 ? '' : 's'} social${quota.limit === 1 ? '' : 'es'}. `
             + `Ya tienes ${quota.current} conectada${quota.current === 1 ? '' : 's'} `
             + `(${quota.connected.join(', ')}). `
             + `Añade una cuenta extra por +€15/mes desde /settings/plan.`,
      quota,
    };
  }

  return { allowed: true, quota };
}

/**
 * Builds the redirect URL for "over quota" flows. OAuth callbacks send the
 * user here when they try to connect beyond their plan — they land on a
 * Settings page that explains the situation + has the "buy extra account"
 * button. Encoded as a query param so the Settings page can surface the
 * specific message + platform name in a toast / banner.
 */
export function overQuotaRedirect(
  origin:   string,
  platform: Platform,
  quota:    QuotaState,
): URL {
  const url = new URL('/settings/plan', origin);
  url.searchParams.set('upsell',           'social_account');
  url.searchParams.set('platform',         platform);
  url.searchParams.set('current_limit',    String(quota.limit));
  url.searchParams.set('connected_count',  String(quota.current));
  return url;
}
