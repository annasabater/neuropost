// =============================================================================
// NEUROPOST — Perceptual hash (dhash) for duplicate detection
// 9x8 grayscale → compare each pixel with its right neighbour → 64-bit hex.
// Simple, fast, and robust enough for detecting obvious near-duplicates.
// =============================================================================

import sharp from 'sharp';
import { createAdminClient } from '@/lib/supabase';

const HASH_WIDTH  = 9;  // columns (we produce 8 bits per row: 9 pixels → 8 comparisons)
const HASH_HEIGHT = 8;

/** Compute a 64-bit dhash and return its hex string (16 chars). */
export async function computeDhash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
    .grayscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .raw()
    .toBuffer();

  // raw.length should be 72 (9 * 8 * 1 channel)
  let bits = '';
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left  = raw[y * HASH_WIDTH + x];
      const right = raw[y * HASH_WIDTH + x + 1];
      bits += left > right ? '1' : '0';
    }
  }
  // 64 bits → 16 hex chars
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(hexA: string, hexB: string): number {
  if (hexA.length !== hexB.length) return Number.POSITIVE_INFINITY;
  let dist = 0;
  for (let i = 0; i < hexA.length; i++) {
    const x = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    // popcount for a 4-bit value
    dist += ((x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1));
  }
  return dist;
}

/**
 * Returns the id of a near-duplicate item in inspiration_bank (distance ≤ 3)
 * or null if nothing similar is found. Limits the scan to the last 500 items
 * to keep it O(500) per call.
 */
export async function findNearDuplicate(
  hash: string,
  maxDistance = 3,
): Promise<{ id: string; distance: number } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from('inspiration_bank')
    .select('id, perceptual_hash')
    .not('perceptual_hash', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!data) return null;
  for (const row of data as { id: string; perceptual_hash: string }[]) {
    const d = hammingDistance(hash, row.perceptual_hash);
    if (d <= maxDistance) return { id: row.id, distance: d };
  }
  return null;
}
