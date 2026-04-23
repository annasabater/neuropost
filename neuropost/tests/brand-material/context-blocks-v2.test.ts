import { describe, it, expect } from 'vitest';
import { formatMaterialItem } from '@/lib/agents/strategy/context-blocks';
import { normalizeMaterial } from '@/lib/brand-material/normalize';
import { FIXED_NOW, makeV1, makeV2 } from './_fixtures';

// ─── Snapshots por categoría (v2 nativo) ────────────────────────────────

describe('formatMaterialItem — schedule v2', () => {
  it('single schedule renders days only', () => {
    const m = makeV2('schedule', {
      schema_version: 2,
      schedules: [{
        label: 'Horario regular',
        days: [
          { day: 'monday', hours: '9-20' },
          { day: 'friday', hours: '9-22' },
        ],
      }],
    });
    expect(formatMaterialItem(m, FIXED_NOW)).toMatchInlineSnapshot(`"Lunes: 9-20, Viernes: 9-22"`);
  });

  it('multiple schedules add "También hay horario definido para" note', () => {
    const m = makeV2('schedule', {
      schema_version: 2,
      schedules: [
        { label: 'Regular', days: [{ day: 'monday', hours: '9-20' }] },
        { label: 'Verano 2025', days: [{ day: 'monday', hours: '10-22' }] },
      ],
    });
    const out = formatMaterialItem(m, FIXED_NOW);
    expect(out).toContain('Lunes: 9-20');
    expect(out).toContain('(También hay horario definido para: Verano 2025)');
  });
});

describe('formatMaterialItem — promo v2', () => {
  it('full promo with cta, discount, conditions, valid_to', () => {
    const m = makeV2('promo', {
      schema_version: 2,
      title:       '20% en toda la carta',
      description: 'fin de semana',
      conditions:  'No acumulable',
      discount:    { type: 'percent', value: '20' },
      valid_to:    '2025-07-15T00:00:00Z',
      cta:         { label: 'Reservar', url: 'https://reservas.com/x' },
    });
    const out = formatMaterialItem(m, FIXED_NOW)!;
    expect(out).toContain('20% en toda la carta');
    expect(out).toContain('Condiciones: No acumulable');
    expect(out).toContain('Descuento: 20%');
    expect(out).toContain('Válido hasta el 15 de julio');
    expect(out).toContain('(https://reservas.com/x)');
  });

  it('minimal promo: title + description only', () => {
    const m = makeV2('promo', { schema_version: 2, title: 'P', description: 'd' });
    expect(formatMaterialItem(m, FIXED_NOW)).toMatchInlineSnapshot(`"P — d"`);
  });
});

describe('formatMaterialItem — data v2', () => {
  it('tratamiento with price + duration + variants', () => {
    const m = makeV2('data', {
      schema_version: 2,
      type:        'tratamiento',
      name:        'Higiene bucal',
      description: 'limpieza con ultrasonidos',
      price:       '45 €',
      duration:    '30 min',
      variants:    [{ label: 'Con fluoración', description: 'protección extra', price: '+10 €' }],
    });
    const out = formatMaterialItem(m, FIXED_NOW)!;
    expect(out).toContain('Higiene bucal: limpieza con ultrasonidos');
    expect(out).toContain('Desde 45 €');
    expect(out).toContain('30 min');
    expect(out).toContain('Variante "Con fluoración"');
  });
});

describe('formatMaterialItem — quote v2', () => {
  it('source=cliente renders as "Testimonio de X"', () => {
    const m = makeV2('quote', {
      schema_version: 2, text: 'excelente servicio', author: 'Ana', source: 'cliente',
    });
    expect(formatMaterialItem(m, FIXED_NOW)).toBe('Testimonio de Ana: «excelente servicio»');
  });
  it('no source → "Cita: «…» — author"', () => {
    const m = makeV2('quote', { schema_version: 2, text: 'la artesanía se cultiva', author: 'María' });
    expect(formatMaterialItem(m, FIXED_NOW)).toBe('Cita: «la artesanía se cultiva» — María');
  });
});

describe('formatMaterialItem — free v2', () => {
  it('with title renders "title: body"', () => {
    const m = makeV2('free', {
      schema_version: 2, title: 'Nuestra historia', content: 'Somos familia desde 1995',
    });
    expect(formatMaterialItem(m, FIXED_NOW)).toMatchInlineSnapshot(`"Nuestra historia: Somos familia desde 1995"`);
  });
  it('without title renders content as-is', () => {
    const m = makeV2('free', { schema_version: 2, content: 'Texto suelto' });
    expect(formatMaterialItem(m, FIXED_NOW)).toBe('Texto suelto');
  });
});

// ─── Equivalencia v1 ↔ v2 — ningún dato se pierde al normalizar ───────

describe('v1 ↔ v2 equivalence — no data loss through normalize', () => {
  it('data v1 preserves label and description', () => {
    const v1 = makeV1('data', { label: '15 años', description: 'de experiencia' });
    const out = formatMaterialItem(normalizeMaterial(v1), FIXED_NOW)!;
    expect(out).toContain('15 años');
    expect(out).toContain('de experiencia');
  });

  it('promo v1 preserves url (was dropped pre-F6; now surfaces through cta)', () => {
    const v1 = makeV1('promo', {
      title: '20%', description: 'fds', url: 'https://reservas.com/x',
    });
    const out = formatMaterialItem(normalizeMaterial(v1), FIXED_NOW)!;
    expect(out).toContain('20%');
    expect(out).toContain('https://reservas.com/x');
  });

  it('schedule v1 preserves all days after normalization', () => {
    const v1 = makeV1('schedule', {
      days: [
        { day: 'monday',  hours: '9-20' },
        { day: 'tuesday', hours: '9-20' },
        { day: 'friday',  hours: '9-22' },
      ],
    });
    const out = formatMaterialItem(normalizeMaterial(v1), FIXED_NOW)!;
    expect(out).toContain('Lunes: 9-20');
    expect(out).toContain('Martes: 9-20');
    expect(out).toContain('Viernes: 9-22');
  });

  it('quote v1 preserves text and author', () => {
    const v1 = makeV1('quote', { text: 'hola', author: 'María' });
    const out = formatMaterialItem(normalizeMaterial(v1), FIXED_NOW)!;
    expect(out).toContain('hola');
    expect(out).toContain('María');
  });

  it('free v1 preserves text', () => {
    const v1 = makeV1('free', { text: 'Somos una heladería familiar' });
    expect(formatMaterialItem(normalizeMaterial(v1), FIXED_NOW))
      .toBe('Somos una heladería familiar');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────

describe('formatMaterialItem — edge cases', () => {
  it('schedule with empty days returns null', () => {
    const m = makeV2('schedule', {
      schema_version: 2,
      schedules: [{ label: 'Vacío', days: [] }],
    });
    expect(formatMaterialItem(m, FIXED_NOW)).toBeNull();
  });

  it('promo with empty title returns null', () => {
    const m = makeV2('promo', { schema_version: 2, title: '', description: 'x' });
    expect(formatMaterialItem(m, FIXED_NOW)).toBeNull();
  });

  it('free with empty content returns null', () => {
    const m = makeV2('free', { schema_version: 2, content: '' });
    expect(formatMaterialItem(m, FIXED_NOW)).toBeNull();
  });
});
