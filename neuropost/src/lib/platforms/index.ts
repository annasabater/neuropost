// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — Multi-platform abstraction layer
//
// Public API for the rest of the app. Import from '@/lib/platforms' only —
// never reach into the concrete provider modules directly, so swapping or
// adding a platform stays a local change.
//
// Example usage (phase 2 preview):
//
//   import { getProvider, getConnection } from '@/lib/platforms';
//
//   const conn = await getConnection(brandId, 'instagram');
//   if (!conn) return null;
//   const ig   = getProvider('instagram');
//   const res  = await ig.publish(normalizedPost, conn);
//
// ─────────────────────────────────────────────────────────────────────────────

export * from './types';
export type { PlatformProvider } from './provider';
export { getProvider, getAllProviders, parsePlatform } from './factory';
export {
  getConnection,
  listConnections,
  upsertConnection,
  markConnectionExpired,
  disconnectPlatform,
  markSynced,
  getExpiringConnections,
} from './repository';
