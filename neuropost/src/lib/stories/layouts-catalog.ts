// =============================================================================
// Phase 2 — Story layouts catalog
// =============================================================================
// Replaces the string-keyed switch in render.tsx with a structured registry.
// Each layout declares its render function plus metadata that the creative
// director (Phase 3) uses to pick a layout based on story_type,
// aesthetic_preset, and image availability — instead of hard-coded strings.

import type { ReactElement } from 'react';
import {
  LayoutBanner,
  LayoutCentered,
  LayoutFlexible,
  LayoutHero,
  LayoutMinimal,
  LayoutOverlay,
  LayoutPhotoOverlay,
  LayoutPhotoSchedule,
  LayoutStat,
  LayoutTable,
  LayoutTagline,
  LayoutUrgent,
  type RenderCtx,
} from './render';

export type StoryType       = 'schedule' | 'promo' | 'quote' | 'data' | 'custom';
export type AestheticPreset = 'moody' | 'creativo' | 'editorial' | 'natural' | 'minimalista' | 'clasico' | 'luxury' | 'vintage';
export type Tonality        = 'text_heavy' | 'photo_heavy' | 'balanced';

export interface LayoutDefinition {
  id:                 string;
  name:               string;
  description:        string;
  render:             (ctx: RenderCtx) => ReactElement;
  supportsImage:      boolean;
  requiresImage:      boolean;
  supportsSchedule:   boolean;
  best_for:           StoryType[];
  aesthetic_affinity: AestheticPreset[];
  tonality:           Tonality;
}

const ALL_AESTHETICS: AestheticPreset[] = [
  'moody', 'creativo', 'editorial', 'natural',
  'minimalista', 'clasico', 'luxury', 'vintage',
];

export const LAYOUT_CATALOG: LayoutDefinition[] = [
  {
    id:                 'centered',
    name:               'Quote Clásica',
    description:        'Fondo color de marca, cita grande centrada en blanco.',
    render:             (ctx) => LayoutCentered(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['quote', 'custom'],
    aesthetic_affinity: ['moody', 'luxury'],
    tonality:           'text_heavy',
  },
  {
    id:                 'minimal',
    name:               'Quote Minimal',
    description:        'Fondo blanco con franja lateral en color de marca y tipografía condensada.',
    render:             (ctx) => LayoutMinimal(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['quote', 'custom', 'data'],
    aesthetic_affinity: ['minimalista', 'editorial'],
    tonality:           'text_heavy',
  },
  {
    id:                 'table',
    name:               'Horario Semanal',
    description:        'Tabla limpia de días y horas sobre fondo blanco.',
    render:             (ctx) => LayoutTable(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   true,
    best_for:           ['schedule'],
    aesthetic_affinity: ['minimalista', 'clasico'],
    tonality:           'text_heavy',
  },
  {
    id:                 'hero',
    name:               'Horario Destacado',
    description:        'Día principal en grande sobre color de marca, resto del horario compacto debajo.',
    render:             (ctx) => LayoutHero(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   true,
    best_for:           ['schedule'],
    aesthetic_affinity: ['creativo', 'editorial'],
    tonality:           'balanced',
  },
  {
    id:                 'banner',
    name:               'Promo Banner',
    description:        'Mitad superior blanca con título de promo, mitad inferior en color de marca con CTA.',
    render:             (ctx) => LayoutBanner(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['promo'],
    aesthetic_affinity: ['creativo', 'luxury'],
    tonality:           'text_heavy',
  },
  {
    id:                 'urgent',
    name:               'Promo Urgente',
    description:        'Fondo oscuro dramático con título en color de marca y franjas de acento.',
    render:             (ctx) => LayoutUrgent(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['promo'],
    aesthetic_affinity: ['moody', 'creativo'],
    tonality:           'text_heavy',
  },
  {
    id:                 'stat',
    name:               'Dato Destacado',
    description:        'Número o estadística enorme en color de marca, contexto corto debajo.',
    render:             (ctx) => LayoutStat(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['data'],
    aesthetic_affinity: ['minimalista', 'editorial', 'clasico'],
    tonality:           'text_heavy',
  },
  {
    id:                 'tagline',
    name:               'Lema de Marca',
    description:        'Fondo color de marca con lema grande centrado y divisor horizontal.',
    render:             (ctx) => LayoutTagline(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['quote', 'custom'],
    aesthetic_affinity: ['editorial', 'luxury', 'clasico'],
    tonality:           'text_heavy',
  },
  {
    id:                 'overlay',
    name:               'Foto con Overlay',
    description:        'Color de marca con gradiente oscuro inferior y texto anclado abajo.',
    render:             (ctx) => LayoutOverlay(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['quote', 'custom'],
    aesthetic_affinity: ['moody', 'vintage'],
    tonality:           'text_heavy',
  },
  {
    id:                 'flexible',
    name:               'Contenido Libre',
    description:        'Fondo claro con borde lateral y contenido de texto flexible.',
    render:             (ctx) => LayoutFlexible(ctx),
    supportsImage:      false,
    requiresImage:      false,
    supportsSchedule:   false,
    best_for:           ['custom', 'quote', 'data'],
    aesthetic_affinity: ALL_AESTHETICS,
    tonality:           'text_heavy',
  },
  {
    id:                 'photo_overlay',
    name:               'Foto Full-Bleed',
    description:        'Foto de fondo a sangre con overlay oscuro y texto blanco grande encima.',
    render:             (ctx) => LayoutPhotoOverlay(ctx),
    supportsImage:      true,
    requiresImage:      true,
    supportsSchedule:   false,
    best_for:           ['quote', 'promo', 'custom'],
    aesthetic_affinity: ['moody', 'editorial', 'natural', 'vintage'],
    tonality:           'photo_heavy',
  },
  {
    id:                 'photo_schedule',
    name:               'Horario sobre Foto',
    description:        'Foto de fondo con overlay oscuro y tabla de horarios blanca encima.',
    render:             (ctx) => LayoutPhotoSchedule(ctx),
    supportsImage:      true,
    requiresImage:      true,
    supportsSchedule:   true,
    best_for:           ['schedule'],
    aesthetic_affinity: ['natural', 'editorial', 'minimalista'],
    tonality:           'photo_heavy',
  },
];

export function getLayoutById(id: string): LayoutDefinition | null {
  return LAYOUT_CATALOG.find(l => l.id === id) ?? null;
}

export function getLayoutsForStoryType(type: StoryType): LayoutDefinition[] {
  return LAYOUT_CATALOG.filter(l => l.best_for.includes(type));
}

export function getLayoutsForAesthetic(preset: AestheticPreset): LayoutDefinition[] {
  return LAYOUT_CATALOG.filter(l => l.aesthetic_affinity.includes(preset));
}
