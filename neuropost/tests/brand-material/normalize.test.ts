import { describe, it, expect } from 'vitest';
import {
  normalizeMaterial, isActiveNow, pickActiveSchedule,
  getMaterialStatus, upgradeContentToV2,
} from '@/lib/brand-material/normalize';
import { CONTENT_SCHEMAS } from '@/types/brand-material';
import {
  FIXED_NOW, makeV1, makeV2,
  SCHEDULE_V1, PROMO_V1, DATA_V1, QUOTE_V1, FREE_V1,
  SCHEDULE_V2, PROMO_V2, DATA_V2, QUOTE_V2, FREE_V2,
} from './_fixtures';
import type { BrandMaterialCategory } from '@/types';

// ─── normalizeMaterial: v1 → v2 ───────────────────────────────────────────

describe('normalizeMaterial — v1 inputs', () => {
  const CASES: Array<[BrandMaterialCategory, Record<string, unknown>]> = [
    ['schedule', SCHEDULE_V1],
    ['promo',    PROMO_V1],
    ['data',     DATA_V1],
    ['quote',    QUOTE_V1],
    ['free',     FREE_V1],
  ];

  for (const [cat, content] of CASES) {
    it(`${cat} v1 normalized parses against v2 schema`, () => {
      const v2 = normalizeMaterial(makeV1(cat, content));
      expect(CONTENT_SCHEMAS[cat].v2.safeParse(v2.content).success).toBe(true);
    });
  }
});

describe('normalizeMaterial — v2 passthrough', () => {
  const CASES: Array<[BrandMaterialCategory, Record<string, unknown>]> = [
    ['schedule', SCHEDULE_V2],
    ['promo',    PROMO_V2],
    ['data',     DATA_V2],
    ['quote',    QUOTE_V2],
    ['free',     FREE_V2],
  ];

  for (const [cat, content] of CASES) {
    it(`${cat} v2 content is preserved byte-for-byte`, () => {
      const v2 = normalizeMaterial(makeV1(cat, content));
      expect(v2.content).toEqual(content);
    });
  }
});

describe('normalizeMaterial — defensive defaults', () => {
  it('empty content does not throw for any category', () => {
    for (const cat of ['schedule','promo','data','quote','free'] as BrandMaterialCategory[]) {
      expect(() => normalizeMaterial(makeV1(cat, {}))).not.toThrow();
    }
  });
  it('empty v1 schedule produces v2 with single schedule, empty days', () => {
    const v2 = normalizeMaterial(makeV1('schedule', {}));
    const c  = v2.content as { schedules: Array<{ label: string; days: unknown[] }> };
    expect(c.schedules).toHaveLength(1);
    expect(c.schedules[0]!.label).toBe('Horario regular');
    expect(c.schedules[0]!.days).toEqual([]);
  });
  it('quote without author gets placeholder', () => {
    const v2 = normalizeMaterial(makeV1('quote', { text: 'hi', author: '' }));
    const c  = v2.content as { author: string };
    expect(c.author).toBe('—');
  });
});

describe('normalizeMaterial — transversal columns', () => {
  it('active_to falls back to valid_until when column missing', () => {
    const row = makeV1('data', DATA_V1, { valid_until: '2026-06-01T00:00:00Z' });
    const v2  = normalizeMaterial(row);
    expect(v2.active_to).toBe('2026-06-01T00:00:00Z');
  });
  it('priority defaults to 0 when missing', () => {
    expect(normalizeMaterial(makeV1('free', FREE_V1)).priority).toBe(0);
  });
  it('platforms defaults to []', () => {
    expect(normalizeMaterial(makeV1('free', FREE_V1)).platforms).toEqual([]);
  });
  it('tags defaults to []', () => {
    expect(normalizeMaterial(makeV1('free', FREE_V1)).tags).toEqual([]);
  });
});

// ─── isActiveNow ──────────────────────────────────────────────────────────

describe('isActiveNow', () => {
  const base = makeV2('free', FREE_V2);

  it('active=false → false regardless of window', () => {
    expect(isActiveNow({ ...base, active: false }, FIXED_NOW)).toBe(false);
  });
  it('active=true with no window → true', () => {
    expect(isActiveNow(base, FIXED_NOW)).toBe(true);
  });
  it('active_from in future → false (scheduled)', () => {
    expect(isActiveNow({ ...base, active_from: '2026-12-31T00:00:00Z' }, FIXED_NOW)).toBe(false);
  });
  it('active_to in past → false (expired)', () => {
    expect(isActiveNow({ ...base, active_to: '2020-01-01T00:00:00Z' }, FIXED_NOW)).toBe(false);
  });
  it('within window → true', () => {
    expect(isActiveNow({
      ...base,
      active_from: '2025-01-01T00:00:00Z',
      active_to:   '2025-12-31T00:00:00Z',
    }, FIXED_NOW)).toBe(true);
  });
  it('now is injectable (not dependent on real clock)', () => {
    // Con ventana pasada y FIXED_NOW en 2025, expira.
    expect(isActiveNow({ ...base, active_to: '2020-01-01T00:00:00Z' }, FIXED_NOW)).toBe(false);
  });
});

// ─── pickActiveSchedule ───────────────────────────────────────────────────

describe('pickActiveSchedule', () => {
  const S = (label: string, extra: { active_from?: string; active_to?: string } = {}) =>
    ({ label, days: [] as Array<{ day: 'monday'; hours: string }>, ...extra });

  it('empty array → null', () => {
    expect(pickActiveSchedule([], FIXED_NOW)).toBeNull();
  });
  it('none active → first element', () => {
    const list = [
      S('A', { active_to: '2020-01-01T00:00:00Z' }),
      S('B', { active_to: '2021-01-01T00:00:00Z' }),
    ];
    expect(pickActiveSchedule(list, FIXED_NOW)?.label).toBe('A');
  });
  it('one active → that one', () => {
    const list = [S('Regular'), S('Verano', { active_from: '2026-07-01T00:00:00Z' })];
    expect(pickActiveSchedule(list, FIXED_NOW)?.label).toBe('Regular');
  });
  it('two active, distinct specificity → more specific wins', () => {
    const list = [
      S('Regular'),
      S('Verano 2025', { active_from: '2025-01-01T00:00:00Z', active_to: '2025-12-31T00:00:00Z' }),
    ];
    expect(pickActiveSchedule(list, FIXED_NOW)?.label).toBe('Verano 2025');
  });
  it('two active, equal specificity → first in array', () => {
    const list = [
      S('A', { active_from: '2025-01-01T00:00:00Z' }),
      S('B', { active_from: '2025-02-01T00:00:00Z' }),
    ];
    expect(pickActiveSchedule(list, FIXED_NOW)?.label).toBe('A');
  });
});

// ─── getMaterialStatus ────────────────────────────────────────────────────

describe('getMaterialStatus', () => {
  const base = makeV2('free', FREE_V2);

  it('returns "active" in base case', () => {
    expect(getMaterialStatus(base, FIXED_NOW)).toBe('active');
  });
  it('returns "scheduled" when active_from is future', () => {
    expect(getMaterialStatus({ ...base, active_from: '2026-12-31T00:00:00Z' }, FIXED_NOW)).toBe('scheduled');
  });
  it('returns "expired" when active_to is past', () => {
    expect(getMaterialStatus({ ...base, active_to: '2020-01-01T00:00:00Z' }, FIXED_NOW)).toBe('expired');
  });
  it('returns "inactive" when active=false', () => {
    expect(getMaterialStatus({ ...base, active: false }, FIXED_NOW)).toBe('inactive');
  });
  it('inactive beats scheduled', () => {
    expect(getMaterialStatus({
      ...base, active: false, active_from: '2026-12-31T00:00:00Z',
    }, FIXED_NOW)).toBe('inactive');
  });
  it('inactive beats expired', () => {
    expect(getMaterialStatus({
      ...base, active: false, active_to: '2020-01-01T00:00:00Z',
    }, FIXED_NOW)).toBe('inactive');
  });
});

// ─── upgradeContentToV2 ───────────────────────────────────────────────────

describe('upgradeContentToV2', () => {
  const CASES: Array<[BrandMaterialCategory, Record<string, unknown>]> = [
    ['schedule', SCHEDULE_V1],
    ['promo',    PROMO_V1],
    ['data',     DATA_V1],
    ['quote',    QUOTE_V1],
    ['free',     FREE_V1],
  ];

  for (const [cat, content] of CASES) {
    it(`${cat}: public helper produces parseable v2`, () => {
      const v2 = upgradeContentToV2(cat, content);
      expect(CONTENT_SCHEMAS[cat].v2.safeParse(v2).success).toBe(true);
    });
  }

  it('promo preserves url as cta', () => {
    const v2 = upgradeContentToV2('promo', { title: 't', description: 'd', url: 'https://x.com' }) as { cta?: { url: string } };
    expect(v2.cta?.url).toBe('https://x.com');
  });

  it('data v1 maps label→name and sets type=otro', () => {
    const v2 = upgradeContentToV2('data', { label: '15 años', description: 'y' }) as { type: string; name: string };
    expect(v2.type).toBe('otro');
    expect(v2.name).toBe('15 años');
  });
});
