// =============================================================================
// Strategy agent — shared prompt context blocks
// =============================================================================
// Loaders that render brand-specific context (favorite inspirations and
// brand_material) as LLM-ready text blocks. Used by strategy:generate_ideas
// and strategy:regenerate_idea — keep here so both stay in sync.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// -----------------------------------------------------------------------------
// Favorites (saved inspirations)
// -----------------------------------------------------------------------------

interface InspirationRow {
  title:      string | null;
  notes:      string | null;
  style_tags: string[] | null;
  category:   string | null;
}

export async function loadFavoritesBlock(db: DB, brandId: string): Promise<string> {
  const { data } = await db
    .from('inspiration_references')
    .select('title, notes, style_tags, category')
    .eq('brand_id', brandId)
    .eq('is_saved', true)
    .order('created_at', { ascending: false })
    .limit(10);

  const rows = (data ?? []) as InspirationRow[];
  if (rows.length === 0) return '';

  const lines = rows.map((r) => {
    const parts: string[] = [];
    if (r.title)      parts.push(r.title);
    if (r.category)   parts.push(`(${r.category})`);
    if (r.notes)      parts.push(`— ${r.notes.slice(0, 120)}`);
    if (r.style_tags?.length) parts.push(`[${r.style_tags.join(', ')}]`);
    return `• ${parts.join(' ')}`;
  });

  return `\n\nINSPIRACIONES GUARDADAS POR EL CLIENTE (favoritos — incorpora su estilo/temática cuando encaje con las categorías):\n${lines.join('\n')}`;
}

// -----------------------------------------------------------------------------
// Brand material (horarios, promociones, datos, frases, texto libre)
// -----------------------------------------------------------------------------
// Sprint 12: los agentes solo hablan v2. La frontera v1 → v2 está en
// `normalizeMaterial()`. Este módulo nunca detecta versiones ni hace switch
// por schema_version.

import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import type { BrandMaterialV2 }                      from '@/types/brand-material';
import {
  normalizeMaterial, isActiveNow, pickActiveSchedule,
}                                                    from '@/lib/brand-material/normalize';

const DAY_ES: Record<string, string> = {
  monday:    'Lunes',
  tuesday:   'Martes',
  wednesday: 'Miércoles',
  thursday:  'Jueves',
  friday:    'Viernes',
  saturday:  'Sábado',
  sunday:    'Domingo',
};

const TYPE_LABEL_ES: Record<string, string> = {
  servicio:    'Servicios',
  tratamiento: 'Tratamientos',
  carta:       'Cartas / Menús',
  clase:       'Clases',
  producto:    'Productos',
  experiencia: 'Experiencias',
  otro:        'Otros',
};

const MONTH_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function humanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getUTCDate()} de ${MONTH_ES[d.getUTCMonth()]}`;
}

function discountLabel(d: NonNullable<BrandMaterialV2<'promo'>['content']['discount']>): string {
  if (d.type === 'free') return 'Descuento: Gratis';
  if (d.type === 'percent') return `Descuento: ${d.value ?? ''}%`.trim();
  if (d.type === 'fixed')   return `Descuento: ${d.value ?? ''}`.trim();
  return '';
}

// Pure, exportable (used elsewhere to preview context per-item).
export function formatMaterialItem(m: BrandMaterialV2, now: Date = new Date()): string | null {
  switch (m.category) {
    case 'schedule': {
      const c = m.content as BrandMaterialV2<'schedule'>['content'];
      const chosen = pickActiveSchedule(c.schedules, now);
      if (!chosen || chosen.days.length === 0) return null;
      const rendered = chosen.days.map(d => `${DAY_ES[d.day.toLowerCase()] ?? d.day}: ${d.hours}`).join(', ');
      const main = rendered.slice(0, 200);
      const others = c.schedules.filter(s => s !== chosen).map(s => s.label).filter(Boolean);
      if (others.length > 0) {
        return `${main}\n  (También hay horario definido para: ${others.join(', ')})`;
      }
      return main;
    }
    case 'promo': {
      const c = m.content as BrandMaterialV2<'promo'>['content'];
      const title = c.title?.trim();
      if (!title) return null;
      const parts: string[] = [title];
      const desc = c.description?.trim();
      if (desc) parts.push(`— ${desc.slice(0, 150)}`);
      if (c.conditions?.trim()) parts.push(`Condiciones: ${c.conditions.trim()}`);
      if (c.discount) {
        const dl = discountLabel(c.discount);
        if (dl) parts.push(dl);
      }
      const validTo = c.valid_to ?? m.active_to ?? m.valid_until;
      if (validTo) parts.push(`Válido hasta el ${humanDate(validTo)}`);
      if (c.cta?.url) parts.push(`(${c.cta.url})`);
      return parts.join(' ');
    }
    case 'data': {
      const c = m.content as BrandMaterialV2<'data'>['content'];
      const name = c.name?.trim();
      if (!name && !c.description?.trim()) return null;
      const head: string[] = [`${name}: ${c.description ?? ''}`.trim()];
      const detail: string[] = [];
      if (c.price?.trim())    detail.push(`Desde ${c.price.trim()}`);
      if (c.duration?.trim()) detail.push(c.duration.trim());
      if (detail.length) head[0] = `${head[0]} ${detail.join(', ')}.`;
      const variants = c.variants ?? [];
      const variantLines = variants
        .map(v => {
          const parts: string[] = [`Variante "${v.label}"`];
          if (v.description?.trim()) parts.push(v.description.trim());
          if (v.price?.trim())       parts.push(v.price.trim());
          return `  - ${parts.filter(Boolean).join(': ').replace('Variante "' + v.label + '": ', `Variante "${v.label}": `)}`;
        })
        .join('\n');
      return variantLines ? `${head[0]}\n${variantLines}` : head[0];
    }
    case 'quote': {
      const c = m.content as BrandMaterialV2<'quote'>['content'];
      const text = c.text?.trim();
      if (!text) return null;
      const quoted = text.slice(0, 200);
      const author = c.author?.trim();
      if (c.source === 'cliente' && author) return `Testimonio de ${author}: «${quoted}»`;
      return author ? `Cita: «${quoted}» — ${author}` : `Cita: «${quoted}»`;
    }
    case 'free': {
      const c = m.content as BrandMaterialV2<'free'>['content'];
      const text = c.content?.trim();
      if (!text) return null;
      const title = c.title?.trim();
      const body = text.slice(0, 250);
      return title ? `${title}: ${body}` : body;
    }
    default: {
      const _exhaustive: never = m.category;
      void _exhaustive;
      return null;
    }
  }
}

const FREE_INTENT_HEADING: Record<string, string> = {
  historia:   'Historias de la marca',
  valores:    'Valores',
  tono_marca: 'Tono de marca',
  aviso:      'Avisos operativos',
  otro:       'Otros textos libres',
};

function freeGroupKey(m: BrandMaterialV2<'free'>): string {
  const c = m.content;
  return c.intent ?? 'otro';
}

function dataGroupKey(m: BrandMaterialV2<'data'>): string {
  return m.content.type;
}

export async function loadBrandMaterialBlock(
  db: DB,
  brandId: string,
  opts?: { platform?: string },
): Promise<string> {
  const { data } = await db
    .from('brand_material')
    .select('id, brand_id, category, content, active, valid_until, active_from, active_to, priority, platforms, tags, display_order, created_at, updated_at')
    .eq('brand_id', brandId)
    .eq('active', true);

  const now = new Date();
  const raw = (data ?? []) as BrandMaterial[];
  const normalized = raw.map(normalizeMaterial);

  const filtered = normalized.filter(m => {
    if (!isActiveNow(m, now)) return false;
    if (opts?.platform) {
      if (m.platforms.length > 0 && !m.platforms.includes(opts.platform)) return false;
    }
    return true;
  });

  filtered.sort((a, b) =>
    (b.priority - a.priority) ||
    b.updated_at.localeCompare(a.updated_at),
  );

  if (filtered.length === 0) return '';

  // Base bucket por categoría con lines ya formateadas.
  const byCategory = new Map<BrandMaterialCategory, BrandMaterialV2[]>();
  for (const m of filtered) {
    const arr = byCategory.get(m.category) ?? [];
    arr.push(m);
    byCategory.set(m.category, arr);
  }

  const sections: Array<[BrandMaterialCategory, string, (items: BrandMaterialV2[]) => string]> = [
    ['schedule', 'Horarios',                          renderSimple],
    ['promo',    'Promociones activas (considera referenciarlas en ideas de esta semana)', renderSimple],
    ['data',     'Catálogo de servicios',             renderCatalog],
    ['quote',    'Frases de marca',                   renderSimple],
    ['free',     'Texto libre',                       renderFree],
  ];

  const parts: string[] = [];
  for (const [cat, heading, renderer] of sections) {
    const items = byCategory.get(cat);
    if (!items || items.length === 0) continue;
    const body = renderer(items);
    if (!body.trim()) continue;
    parts.push(`${heading}:\n${body}`);
  }

  if (parts.length === 0) return '';

  return `\n\nMATERIAL DE MARCA DISPONIBLE (úsalo cuando sea pertinente en las ideas):\n\n${parts.join('\n\n')}`;
}

function renderSimple(items: BrandMaterialV2[]): string {
  return items
    .map(m => formatMaterialItem(m))
    .filter((l): l is string => !!l)
    .map(l => `• ${l}`)
    .join('\n');
}

function renderCatalog(items: BrandMaterialV2[]): string {
  const byType = new Map<string, BrandMaterialV2<'data'>[]>();
  for (const m of items as BrandMaterialV2<'data'>[]) {
    const key = dataGroupKey(m);
    (byType.get(key) ?? byType.set(key, []).get(key)!).push(m);
  }
  const orderedTypes = ['servicio','tratamiento','carta','clase','producto','experiencia','otro'];
  const chunks: string[] = [];
  for (const t of orderedTypes) {
    const list = byType.get(t);
    if (!list || list.length === 0) continue;
    const heading = TYPE_LABEL_ES[t] ?? t;
    const lines = list.map(m => formatMaterialItem(m)).filter((l): l is string => !!l).map(l => `- ${l}`);
    if (lines.length === 0) continue;
    chunks.push(`${heading}:\n${lines.join('\n')}`);
  }
  return chunks.join('\n\n');
}

function renderFree(items: BrandMaterialV2[]): string {
  const groups = new Map<string, BrandMaterialV2<'free'>[]>();
  for (const m of items as BrandMaterialV2<'free'>[]) {
    const key = freeGroupKey(m);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }
  const ordered = ['historia','valores','tono_marca','aviso','otro'];
  const chunks: string[] = [];
  for (const k of ordered) {
    const list = groups.get(k);
    if (!list || list.length === 0) continue;
    const heading = FREE_INTENT_HEADING[k] ?? 'Otros textos libres';
    const lines = list.map(m => formatMaterialItem(m)).filter((l): l is string => !!l).map(l => `• ${l}`);
    if (lines.length === 0) continue;
    chunks.push(`${heading}:\n${lines.join('\n')}`);
  }
  return chunks.join('\n\n');
}
