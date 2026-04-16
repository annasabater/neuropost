// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — platform_connections repository
//
// Thin data-access layer over the `platform_connections` table. Used by
// providers, routes, and the refresh-tokens cron. Nobody reads the table
// directly — go through these helpers so the DB shape can change without
// a scattershot refactor.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase';
import type { Connection, Platform } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface ConnectionRow {
  id:                     string;
  brand_id:               string;
  platform:               Platform;
  platform_user_id:       string;
  platform_username:      string | null;
  access_token:           string;
  refresh_token:          string | null;
  expires_at:             string | null;
  refresh_expires_at:     string | null;
  status:                 Connection['status'];
  last_token_refresh_at:  string | null;
  last_insights_synced_at:string | null;
  last_feed_synced_at:    string | null;
  metadata:               Record<string, unknown> | null;
}

function rowToConnection(row: ConnectionRow): Connection {
  return {
    id:                row.id,
    brandId:           row.brand_id,
    platform:          row.platform,
    platformUserId:    row.platform_user_id,
    platformUsername:  row.platform_username,
    accessToken:       row.access_token,
    refreshToken:      row.refresh_token,
    expiresAt:         row.expires_at         ? new Date(row.expires_at)         : null,
    refreshExpiresAt:  row.refresh_expires_at ? new Date(row.refresh_expires_at) : null,
    status:            row.status,
    metadata:          row.metadata ?? {},
  };
}

/** Load a single (brand, platform) connection, or null if not connected. */
export async function getConnection(
  brandId:  string,
  platform: Platform,
): Promise<Connection | null> {
  const db = createAdminClient() as DB;
  const { data } = await db
    .from('platform_connections')
    .select('*')
    .eq('brand_id', brandId)
    .eq('platform', platform)
    .maybeSingle();
  return data ? rowToConnection(data as ConnectionRow) : null;
}

/** List every active platform this brand has connected. */
export async function listConnections(brandId: string): Promise<Connection[]> {
  const db = createAdminClient() as DB;
  const { data } = await db
    .from('platform_connections')
    .select('*')
    .eq('brand_id', brandId);
  return (data ?? []).map((r: ConnectionRow) => rowToConnection(r));
}

/** Insert or update a connection (match on brand_id + platform). */
export async function upsertConnection(
  partial: Omit<Connection, 'id'> & { id?: string },
): Promise<Connection> {
  const db = createAdminClient() as DB;
  const payload = {
    brand_id:           partial.brandId,
    platform:           partial.platform,
    platform_user_id:   partial.platformUserId,
    platform_username:  partial.platformUsername,
    access_token:       partial.accessToken,
    refresh_token:      partial.refreshToken,
    expires_at:         partial.expiresAt?.toISOString()        ?? null,
    refresh_expires_at: partial.refreshExpiresAt?.toISOString() ?? null,
    status:             partial.status,
    metadata:           partial.metadata,
  };
  const { data, error } = await db
    .from('platform_connections')
    .upsert(payload, { onConflict: 'brand_id,platform' })
    .select()
    .single();
  if (error) throw error;
  return rowToConnection(data as ConnectionRow);
}

/** Mark a connection as no longer valid. Does NOT delete the row — keeps
 *  historic bookkeeping so we can show "reconnect" prompts in the UI. */
export async function markConnectionExpired(
  brandId:  string,
  platform: Platform,
  reason?:  string,
): Promise<void> {
  const db = createAdminClient() as DB;
  await db
    .from('platform_connections')
    .update({
      status:   'expired',
      metadata: reason ? { expired_reason: reason } : undefined,
    })
    .eq('brand_id', brandId)
    .eq('platform', platform);
}

/** Full disconnect — wipes the connection row. */
export async function disconnectPlatform(
  brandId:  string,
  platform: Platform,
): Promise<void> {
  const db = createAdminClient() as DB;
  await db
    .from('platform_connections')
    .delete()
    .eq('brand_id', brandId)
    .eq('platform', platform);
}

/**
 * Timestamp-only updates, called by the insights / feed sync crons so we
 * know per-platform when a brand was last synced.
 */
export async function markSynced(
  brandId:  string,
  platform: Platform,
  kind:     'insights' | 'feed',
): Promise<void> {
  const field = kind === 'insights' ? 'last_insights_synced_at' : 'last_feed_synced_at';
  const db = createAdminClient() as DB;
  await db
    .from('platform_connections')
    .update({ [field]: new Date().toISOString() })
    .eq('brand_id', brandId)
    .eq('platform', platform);
}

/** Returns all connections that will expire within the given window.
 *  Used by the refresh-tokens cron. */
export async function getExpiringConnections(withinMs: number): Promise<Connection[]> {
  const db = createAdminClient() as DB;
  const threshold = new Date(Date.now() + withinMs).toISOString();
  const { data } = await db
    .from('platform_connections')
    .select('*')
    .eq('status', 'active')
    .lt('expires_at', threshold);
  return (data ?? []).map((r: ConnectionRow) => rowToConnection(r));
}
