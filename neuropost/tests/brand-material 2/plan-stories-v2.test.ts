import { describe, it, expect } from 'vitest';
import { buildCopyFromSource, buildSlots } from '@/lib/agents/stories/plan-stories';
import { normalizeMaterial } from '@/lib/brand-material/normalize';
import type { BrandMaterial } from '@/types';
import { FIXED_NOW, makeV1, makeV2 } from './_fixtures';

// ═════════════════════════════════════════════════════════════════════════
// TEST SAGRADO — la garantía verbatim del copy de schedule NO puede cambiar.
// El output de buildCopyFromSource sobre un material v1 normalizado debe
// coincidir byte-a-byte con el output que la versión pre-F6 producía.
// Si alguien rompe esto, las stories de schedule se corrompen en producción.
// ═════════════════════════════════════════════════════════════════════════

describe('buildCopyFromSource — schedule verbatim (SAGRADO)', () => {
  it('v1 → normalize → buildCopyFromSource produces pre-F6 identical output', () => {
    const v1: BrandMaterial = makeV1('schedule', {
      days: [
        { day: 'monday',    hours: '9-20' },
        { day: 'tuesday',   hours: '9-20' },
        { day: 'wednesday', hours: '9-20' },
        { day: 'thursday',  hours: '9-20' },
        { day: 'friday',    hours: '9-22' },
        { day: 'saturday',  hours: '10-22' },
      ],
    });
    const expected = 'Lunes: 9-20\nMartes: 9-20\nMiércoles: 9-20\nJueves: 9-20\nViernes: 9-22\nSábado: 10-22';
    const actual = buildCopyFromSource('schedule', normalizeMaterial(v1), FIXED_NOW);
    expect(actual).toBe(expected);
  });

  it('minimal v1 single day preserved', () => {
    const v1 = makeV1('schedule', { days: [{ day: 'friday', hours: '9-22' }] });
    expect(buildCopyFromSource('schedule', normalizeMaterial(v1), FIXED_NOW))
      .toBe('Viernes: 9-22');
  });
});

// ─── buildCopyFromSource por tipo (v2 nativo) ────────────────────────────

describe('buildCopyFromSource — promo v2', () => {
  it('title + description concatenated with newline', () => {
    const m = makeV2('promo', { schema_version: 2, title: '20%', description: 'fds' });
    expect(buildCopyFromSource('promo', m, FIXED_NOW)).toBe('20%\nfds');
  });
  it('cta.label is appended', () => {
    const m = makeV2('promo', {
      schema_version: 2, title: '20%', description: 'fds',
      cta: { label: 'Reservar', url: 'https://x.com' },
    });
    expect(buildCopyFromSource('promo', m, FIXED_NOW)).toContain('Reservar');
  });
});

describe('buildCopyFromSource — data v2', () => {
  it('base: name: description', () => {
    const m = makeV2('data', {
      schema_version: 2, type: 'servicio', name: 'Higiene', description: 'bucal',
    });
    expect(buildCopyFromSource('data', m, FIXED_NOW)).toBe('Higiene: bucal');
  });
  it('1 variant → appends "Opciones: label"', () => {
    const m = makeV2('data', {
      schema_version: 2, type: 'servicio', name: 'Higiene', description: 'bucal',
      variants: [{ label: 'Con fluoración' }],
    });
    expect(buildCopyFromSource('data', m, FIXED_NOW)).toContain('Opciones: Con fluoración');
  });
  it('2 variants → lists both', () => {
    const m = makeV2('data', {
      schema_version: 2, type: 'servicio', name: 'Higiene', description: 'bucal',
      variants: [{ label: 'A' }, { label: 'B' }],
    });
    expect(buildCopyFromSource('data', m, FIXED_NOW)).toContain('Opciones: A, B');
  });
  it('3+ variants → does NOT list them (would saturate the story)', () => {
    const m = makeV2('data', {
      schema_version: 2, type: 'servicio', name: 'Higiene', description: 'bucal',
      variants: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
    });
    expect(buildCopyFromSource('data', m, FIXED_NOW)).not.toContain('Opciones:');
  });
});

describe('buildCopyFromSource — quote v2', () => {
  it('format «text» — author', () => {
    const m = makeV2('quote', { schema_version: 2, text: 'hola', author: 'María' });
    expect(buildCopyFromSource('quote', m, FIXED_NOW)).toBe('«hola» — María');
  });
});

describe('buildCopyFromSource — free (StoryType custom)', () => {
  it('returns content.content verbatim', () => {
    const m = makeV2('free', { schema_version: 2, content: 'texto libre' });
    expect(buildCopyFromSource('custom', m, FIXED_NOW)).toBe('texto libre');
  });
});

// ─── buildSlots — conteo y filtrado ─────────────────────────────────────

describe('buildSlots — slot count and filtering', () => {
  function bag() {
    return [
      normalizeMaterial(makeV1('schedule', { days: [{ day: 'monday', hours: '9-20' }] })),
      normalizeMaterial(makeV1('promo',    { title: 'P1', description: 'd1' }, { valid_until: '2030-01-01T00:00:00Z' })),
      normalizeMaterial(makeV1('promo',    { title: 'P2', description: 'd2' }, { valid_until: '2030-01-01T00:00:00Z' })),
      normalizeMaterial(makeV1('data',     { label: 'D1', description: 'x' })),
      normalizeMaterial(makeV1('data',     { label: 'D2', description: 'x' })),
      normalizeMaterial(makeV1('data',     { label: 'D3', description: 'x' })),
      normalizeMaterial(makeV1('quote',    { text: 'Q1', author: 'a' })),
      normalizeMaterial(makeV1('quote',    { text: 'Q2', author: 'b' })),
      normalizeMaterial(makeV1('free',     { text: 'F1' })),
    ];
  }

  it('respects stories_per_week upper bound', () => {
    const slots = buildSlots(bag(), 5);
    expect(slots).toHaveLength(5);
  });

  it('first slot is always schedule when one is active', () => {
    const slots = buildSlots(bag(), 5);
    expect(slots[0]!.type).toBe('schedule');
  });

  it('expired promo is excluded', () => {
    const bagWithExpired = [
      normalizeMaterial(makeV1('promo', { title: 'old', description: 'd' }, { valid_until: '2020-01-01T00:00:00Z' })),
      normalizeMaterial(makeV1('promo', { title: 'new', description: 'd' }, { valid_until: '2030-01-01T00:00:00Z' })),
      normalizeMaterial(makeV1('quote', { text: 'q', author: 'a' })),
    ];
    const slots = buildSlots(bagWithExpired, 5);
    const promoSlots = slots.filter(s => s.type === 'promo');
    expect(promoSlots).toHaveLength(1);
    expect((promoSlots[0]!.source!.content as { title: string }).title).toBe('new');
  });

  it('active=false material is excluded', () => {
    const bagWithInactive = [
      normalizeMaterial(makeV1('schedule', { days: [{ day: 'monday', hours: '9-20' }] }, { active: false })),
      normalizeMaterial(makeV1('quote',    { text: 'q', author: 'a' })),
    ];
    const slots = buildSlots(bagWithInactive, 3);
    expect(slots.filter(s => s.type === 'schedule')).toHaveLength(0);
  });

  it('no schedule available → slots rolled over to other types', () => {
    const noSchedule = [
      normalizeMaterial(makeV1('quote', { text: 'q', author: 'a' })),
      normalizeMaterial(makeV1('data',  { label: 'd', description: 'x' })),
    ];
    const slots = buildSlots(noSchedule, 3);
    expect(slots.some(s => s.type === 'schedule' && s.source === null)).toBe(false);
  });

  it('max 3 promo slots (policy)', () => {
    const promoHeavy = Array.from({ length: 6 }, (_, i) =>
      normalizeMaterial(makeV1('promo', { title: `P${i}`, description: 'd' }, { valid_until: '2030-01-01T00:00:00Z' })),
    );
    const slots = buildSlots(promoHeavy, 5);
    expect(slots.filter(s => s.type === 'promo').length).toBeLessThanOrEqual(3);
  });
});
