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

const DAY_ES: Record<string, string> = {
  monday:    'Lunes',
  tuesday:   'Martes',
  wednesday: 'Miércoles',
  thursday:  'Jueves',
  friday:    'Viernes',
  saturday:  'Sábado',
  sunday:    'Domingo',
};

interface BrandMaterialRow {
  category:    'schedule' | 'promo' | 'data' | 'quote' | 'free';
  content:     Record<string, unknown>;
  valid_until: string | null;
  updated_at:  string;
}

function formatMaterialItem(row: BrandMaterialRow): string | null {
  const c = row.content as Record<string, unknown>;
  switch (row.category) {
    case 'schedule': {
      const days = (c.days as Array<{ day: string; hours: string }> | undefined) ?? [];
      if (days.length === 0) return null;
      const rendered = days.map(d => `${DAY_ES[d.day.toLowerCase()] ?? d.day}: ${d.hours}`).join(', ');
      return rendered.slice(0, 200);
    }
    case 'promo': {
      const title = (c.title as string | undefined)?.trim();
      if (!title) return null;
      const desc  = (c.description as string | undefined)?.trim();
      const parts: string[] = [title];
      if (desc)            parts.push(`— ${desc.slice(0, 150)}`);
      if (row.valid_until) parts.push(`(válido hasta ${row.valid_until.slice(0, 10)})`);
      return parts.join(' ');
    }
    case 'data': {
      const label = (c.label as string | undefined)?.trim();
      const desc  = (c.description as string | undefined)?.trim();
      if (!label && !desc) return null;
      return [label, desc].filter(Boolean).join(' — ').slice(0, 150);
    }
    case 'quote': {
      const text = (c.text as string | undefined)?.trim();
      if (!text) return null;
      const author = (c.author as string | undefined)?.trim();
      const quoted = `«${text.slice(0, 200)}»`;
      return author ? `${quoted} — ${author}` : quoted;
    }
    case 'free': {
      const text = (c.text as string | undefined)?.trim();
      if (!text) return null;
      return text.slice(0, 250);
    }
    default:
      return null;
  }
}

export async function loadBrandMaterialBlock(db: DB, brandId: string): Promise<string> {
  const { data } = await db
    .from('brand_material')
    .select('category, content, valid_until, updated_at')
    .eq('brand_id', brandId)
    .eq('active', true)
    .order('updated_at', { ascending: false });

  const now  = Date.now();
  const rows = ((data ?? []) as BrandMaterialRow[]).filter(r => {
    if (r.valid_until === null) return true;
    return new Date(r.valid_until).getTime() > now;
  });

  if (rows.length === 0) return '';

  const byCategory = new Map<BrandMaterialRow['category'], string[]>();
  for (const r of rows) {
    const line = formatMaterialItem(r);
    if (!line) continue;
    const arr = byCategory.get(r.category) ?? [];
    arr.push(`• ${line}`);
    byCategory.set(r.category, arr);
  }

  const sections: Array<[BrandMaterialRow['category'], string]> = [
    ['schedule', 'Horarios'],
    ['promo',    'Promociones activas (considera referenciarlas en ideas de esta semana)'],
    ['data',     'Datos de negocio'],
    ['quote',    'Frases de marca'],
    ['free',     'Texto libre'],
  ];

  const parts: string[] = [];
  for (const [cat, heading] of sections) {
    const lines = byCategory.get(cat);
    if (!lines || lines.length === 0) continue;
    parts.push(`${heading}:\n${lines.join('\n')}`);
  }

  if (parts.length === 0) return '';

  return `\n\nMATERIAL DE MARCA DISPONIBLE (úsalo cuando sea pertinente en las ideas):\n\n${parts.join('\n\n')}`;
}
