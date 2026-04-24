import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import type { BrandMaterialV2 } from '@/types/brand-material';

export const FIXED_NOW = new Date('2025-06-15T12:00:00Z');

const baseRow = {
  id:            'test-id',
  brand_id:      'test-brand',
  active:        true,
  valid_until:   null,
  display_order: 0,
  created_at:    '2025-01-01T00:00:00Z',
  updated_at:    '2025-01-01T00:00:00Z',
} as const;

export function makeV1(
  category: BrandMaterialCategory,
  content: Record<string, unknown>,
  overrides: Partial<BrandMaterial> = {},
): BrandMaterial {
  return {
    ...baseRow,
    ...overrides,
    category,
    content,
  };
}

export function makeV2<C extends BrandMaterialCategory>(
  category: C,
  content: Record<string, unknown>,
  overrides: Partial<BrandMaterialV2> = {},
): BrandMaterialV2 {
  return {
    ...baseRow,
    active_from: null,
    active_to:   null,
    priority:    0,
    platforms:   [],
    tags:        [],
    ...overrides,
    category,
    content: content as BrandMaterialV2<C>['content'],
  } as BrandMaterialV2;
}

export const SCHEDULE_V1 = {
  days: [
    { day: 'monday',   hours: '9-20' },
    { day: 'tuesday',  hours: '9-20' },
    { day: 'friday',   hours: '9-22' },
  ],
};

export const PROMO_V1 = {
  title:       '20% en toda la carta',
  description: 'Este fin de semana',
  url:         'https://reservas.com/x',
};

export const DATA_V1  = { label: '15 años', description: 'de experiencia' };
export const QUOTE_V1 = { text: 'La artesanía se cultiva', author: 'María' };
export const FREE_V1  = { text: 'Somos una heladería familiar' };

export const SCHEDULE_V2 = {
  schema_version: 2,
  schedules: [{ label: 'Horario regular', days: SCHEDULE_V1.days }],
};

export const PROMO_V2 = {
  schema_version: 2,
  title:       '20% en toda la carta',
  description: 'Este fin de semana',
};

export const DATA_V2 = {
  schema_version: 2,
  type:        'tratamiento',
  name:        'Higiene bucal',
  description: 'limpieza con ultrasonidos',
  price:       'Desde 45 €',
  duration:    '30 min',
};

export const QUOTE_V2 = {
  schema_version: 2,
  text:   'La artesanía se cultiva',
  author: 'María',
};

export const FREE_V2 = {
  schema_version: 2,
  content: 'Somos una heladería familiar',
};
