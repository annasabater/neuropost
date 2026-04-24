// =============================================================================
// Phase 2.C — Server-only render registry
// =============================================================================
// Pairs each catalog id with its LayoutXxx component. Imports next/og transitively
// through ./render, so this file MUST NOT be imported from client components.
// Consumers: render.tsx internal dispatcher, API routes, workers.

import type { ReactElement } from 'react';
import type { LayoutDefinition } from './layouts-catalog';
import {
  LayoutBanner,
  LayoutCentered,
  LayoutCompareSplit,
  LayoutEditorialLargeTitle,
  LayoutFlexible,
  LayoutHero,
  LayoutMinimal,
  LayoutMinimalColorBlock,
  LayoutOverlay,
  LayoutPhotoCornerText,
  LayoutPhotoFullbleedClean,
  LayoutPhotoFullbleedWithProp,
  LayoutPhotoGridSchedule,
  LayoutPhotoOverlay,
  LayoutPhotoSchedule,
  LayoutPhotoSplitBottom,
  LayoutPhotoSplitTop,
  LayoutProductHeroCta,
  LayoutQuoteEditorialSerif,
  LayoutStat,
  LayoutStatHighlightClean,
  LayoutStoryNumberedSeries,
  LayoutTable,
  LayoutTagline,
  LayoutUrgent,
  type RenderCtx,
} from './render';

type Renderer = (ctx: RenderCtx) => ReactElement;

export const LAYOUT_RENDERERS: Record<string, Renderer> = {
  centered:                  (ctx) => LayoutCentered(ctx),
  minimal:                   (ctx) => LayoutMinimal(ctx),
  table:                     (ctx) => LayoutTable(ctx),
  hero:                      (ctx) => LayoutHero(ctx),
  banner:                    (ctx) => LayoutBanner(ctx),
  urgent:                    (ctx) => LayoutUrgent(ctx),
  stat:                      (ctx) => LayoutStat(ctx),
  tagline:                   (ctx) => LayoutTagline(ctx),
  overlay:                   (ctx) => LayoutOverlay(ctx),
  flexible:                  (ctx) => LayoutFlexible(ctx),
  photo_overlay:             (ctx) => LayoutPhotoOverlay(ctx),
  photo_schedule:            (ctx) => LayoutPhotoSchedule(ctx),
  photo_fullbleed_clean:     (ctx) => LayoutPhotoFullbleedClean(ctx),
  photo_fullbleed_with_prop: (ctx) => LayoutPhotoFullbleedWithProp(ctx),
  photo_split_top:           (ctx) => LayoutPhotoSplitTop(ctx),
  photo_split_bottom:        (ctx) => LayoutPhotoSplitBottom(ctx),
  photo_corner_text:         (ctx) => LayoutPhotoCornerText(ctx),
  photo_grid_schedule:       (ctx) => LayoutPhotoGridSchedule(ctx),
  editorial_large_title:     (ctx) => LayoutEditorialLargeTitle(ctx),
  minimal_color_block:       (ctx) => LayoutMinimalColorBlock(ctx),
  stat_highlight_clean:      (ctx) => LayoutStatHighlightClean(ctx),
  quote_editorial_serif:     (ctx) => LayoutQuoteEditorialSerif(ctx),
  product_hero_cta:          (ctx) => LayoutProductHeroCta(ctx),
  story_numbered_series:     (ctx) => LayoutStoryNumberedSeries(ctx),
  compare_split:             (ctx) => LayoutCompareSplit(ctx),
};

export function getRendererById(id: string): Renderer | null {
  return LAYOUT_RENDERERS[id] ?? null;
}

/**
 * Returns a renderer by id; if not found, falls back to 'centered' to match
 * the legacy dispatcher default. Kept as a guaranteed-non-null contract for
 * render.tsx's buildJSX.
 */
export function getRendererOrDefault(id: string, def: LayoutDefinition | null = null): Renderer {
  const r = LAYOUT_RENDERERS[id];
  if (r) return r;
  if (def) {
    const byDef = LAYOUT_RENDERERS[def.id];
    if (byDef) return byDef;
  }
  return LAYOUT_RENDERERS['centered']!;
}
