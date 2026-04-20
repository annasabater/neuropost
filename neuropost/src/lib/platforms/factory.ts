// ─────────────────────────────────────────────────────────────────────────────
// NeuroPost — Platform provider factory
//
// Single entry point for getting a provider by platform id. Routes + crons
// use this; they never import concrete provider classes directly. Adding a
// new platform = register it here, update the Platform union, done.
// ─────────────────────────────────────────────────────────────────────────────

import type { Platform } from './types';
import type { PlatformProvider } from './provider';
import { InstagramProvider } from './instagram/provider';
import { FacebookProvider  } from './facebook/provider';
import { TikTokProvider    } from './tiktok/provider';

// Singletons — providers are stateless, one instance per platform is fine.
const _providers: Readonly<Record<Platform, PlatformProvider>> = Object.freeze({
  instagram: new InstagramProvider(),
  facebook:  new FacebookProvider(),
  tiktok:    new TikTokProvider(),
});

/** Returns the provider for a given platform. Throws if unknown. */
export function getProvider(platform: Platform): PlatformProvider {
  const p = _providers[platform];
  if (!p) throw new Error(`Unknown platform: ${platform}`);
  return p;
}

/** Iterate every registered provider — used by "publish to all connected" flows. */
export function getAllProviders(): readonly PlatformProvider[] {
  return Object.values(_providers);
}

/** Narrow a string (e.g. from a URL param) to a valid Platform or null. */
export function parsePlatform(value: unknown): Platform | null {
  if (value === 'instagram' || value === 'facebook' || value === 'tiktok') return value;
  return null;
}
