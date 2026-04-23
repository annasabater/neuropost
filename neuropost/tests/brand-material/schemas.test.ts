import { describe, it, expect } from 'vitest';
import {
  CONTENT_SCHEMAS,
  ScheduleContentV1, ScheduleContentV2,
  PromoContentV1,    PromoContentV2,
  DataContentV1,     DataContentV2,
  QuoteContentV1,    QuoteContentV2,
  FreeContentV1,     FreeContentV2,
  detectSchemaVersion,
} from '@/types/brand-material';

describe('CONTENT_SCHEMAS — schedule', () => {
  it('v1 happy path', () => {
    expect(ScheduleContentV1.safeParse({ days: [{ day: 'monday', hours: '9-20' }] }).success).toBe(true);
  });
  it('v2 happy path', () => {
    expect(ScheduleContentV2.safeParse({
      schema_version: 2,
      schedules: [{ label: 'Regular', days: [{ day: 'monday', hours: '9-20' }] }],
    }).success).toBe(true);
  });
  it('v1 .strict() rejects v2 fields', () => {
    expect(ScheduleContentV1.safeParse({ days: [], schedules: [], schema_version: 2 }).success).toBe(false);
  });
  it('v2 requires non-empty schedules', () => {
    expect(ScheduleContentV2.safeParse({ schema_version: 2, schedules: [] }).success).toBe(false);
  });
  it('v1 shape rejected by v2 schema', () => {
    expect(ScheduleContentV2.safeParse({ days: [{ day: 'monday', hours: '9-20' }] }).success).toBe(false);
  });
  it('v2 shape rejected by v1 schema (.strict extras)', () => {
    expect(ScheduleContentV1.safeParse({
      schema_version: 2,
      schedules: [{ label: 'x', days: [] }],
    }).success).toBe(false);
  });
});

describe('CONTENT_SCHEMAS — promo', () => {
  it('v1 happy path', () => {
    expect(PromoContentV1.safeParse({ title: 'x', description: 'y' }).success).toBe(true);
  });
  it('v2 happy path', () => {
    expect(PromoContentV2.safeParse({ schema_version: 2, title: 'x', description: 'y' }).success).toBe(true);
  });
  it('v1 .strict() rejects extras', () => {
    expect(PromoContentV1.safeParse({ title: 'x', some_extra: true }).success).toBe(false);
  });
  it('v2 requires non-empty title', () => {
    expect(PromoContentV2.safeParse({ schema_version: 2, title: '', description: 'y' }).success).toBe(false);
  });
  it('v1 rejects v2 shape', () => {
    expect(PromoContentV1.safeParse({ schema_version: 2, title: 'x', description: 'y' }).success).toBe(false);
  });
  it('v2 rejects v1 shape (missing schema_version)', () => {
    expect(PromoContentV2.safeParse({ title: 'x', description: 'y' }).success).toBe(false);
  });
});

describe('CONTENT_SCHEMAS — data', () => {
  it('v1 happy path', () => {
    expect(DataContentV1.safeParse({ label: '15', description: 'y' }).success).toBe(true);
  });
  it('v2 happy path', () => {
    expect(DataContentV2.safeParse({
      schema_version: 2, type: 'servicio', name: 'n', description: 'd',
    }).success).toBe(true);
  });
  it('v1 .strict() rejects extras', () => {
    expect(DataContentV1.safeParse({ label: '15', description: 'y', type: 'x' }).success).toBe(false);
  });
  it('v2 rejects empty name', () => {
    expect(DataContentV2.safeParse({
      schema_version: 2, type: 'servicio', name: '', description: 'd',
    }).success).toBe(false);
  });
  it('v1 rejects v2 shape', () => {
    expect(DataContentV1.safeParse({ schema_version: 2, type: 'servicio', name: 'n', description: 'd' }).success).toBe(false);
  });
  it('v2 rejects v1 shape', () => {
    expect(DataContentV2.safeParse({ label: '15', description: 'y' }).success).toBe(false);
  });
});

describe('CONTENT_SCHEMAS — quote', () => {
  it('v1 happy path', () => {
    expect(QuoteContentV1.safeParse({ text: 't', author: 'a' }).success).toBe(true);
  });
  it('v2 happy path', () => {
    expect(QuoteContentV2.safeParse({ schema_version: 2, text: 't', author: 'a' }).success).toBe(true);
  });
  it('v1 .strict() rejects extras', () => {
    expect(QuoteContentV1.safeParse({ text: 't', author: 'a', source: 'cliente' }).success).toBe(false);
  });
  it('v2 requires non-empty text and author', () => {
    expect(QuoteContentV2.safeParse({ schema_version: 2, text: '', author: 'a' }).success).toBe(false);
    expect(QuoteContentV2.safeParse({ schema_version: 2, text: 't', author: '' }).success).toBe(false);
  });
  it('v1 rejects v2 shape', () => {
    expect(QuoteContentV1.safeParse({ schema_version: 2, text: 't', author: 'a' }).success).toBe(false);
  });
});

describe('CONTENT_SCHEMAS — free', () => {
  it('v1 happy path', () => {
    expect(FreeContentV1.safeParse({ text: 'x' }).success).toBe(true);
  });
  it('v2 happy path', () => {
    expect(FreeContentV2.safeParse({ schema_version: 2, content: 'x' }).success).toBe(true);
  });
  it('v1 .strict() rejects extras', () => {
    expect(FreeContentV1.safeParse({ text: 'x', intent: 'valores' }).success).toBe(false);
  });
  it('v2 requires non-empty content', () => {
    expect(FreeContentV2.safeParse({ schema_version: 2, content: '' }).success).toBe(false);
  });
  it('v1 rejects v2 shape', () => {
    expect(FreeContentV1.safeParse({ schema_version: 2, content: 'x' }).success).toBe(false);
  });
});

describe('CONTENT_SCHEMAS dispatcher', () => {
  it('v1 and v2 are independently safeParse-able per category', () => {
    for (const cat of ['schedule','promo','data','quote','free'] as const) {
      expect(typeof CONTENT_SCHEMAS[cat].v1.safeParse).toBe('function');
      expect(typeof CONTENT_SCHEMAS[cat].v2.safeParse).toBe('function');
    }
  });
  it('.data.v1 accepts v1 shape', () => {
    expect(CONTENT_SCHEMAS.data.v1.safeParse({ label: 'x', description: 'y' }).success).toBe(true);
  });
  it('.data.v2 accepts v2 shape', () => {
    expect(CONTENT_SCHEMAS.data.v2.safeParse({
      schema_version: 2, type: 'otro', name: 'n', description: 'd',
    }).success).toBe(true);
  });
});

describe('detectSchemaVersion', () => {
  it('returns 1 for empty object', () => {
    expect(detectSchemaVersion({})).toBe(1);
  });
  it('returns 1 for null', () => {
    expect(detectSchemaVersion(null)).toBe(1);
  });
  it('returns 2 when schema_version is 2', () => {
    expect(detectSchemaVersion({ schema_version: 2 })).toBe(2);
  });
  it('returns 1 when schema_version is 1', () => {
    expect(detectSchemaVersion({ schema_version: 1 })).toBe(1);
  });
  it('returns 1 when schema_version is missing but other fields present', () => {
    expect(detectSchemaVersion({ label: 'x' })).toBe(1);
  });
  it('returns 1 for primitive inputs', () => {
    expect(detectSchemaVersion('hello')).toBe(1);
    expect(detectSchemaVersion(42)).toBe(1);
    expect(detectSchemaVersion(undefined)).toBe(1);
  });
});
