'use client';

import type { BrandMaterialCategory } from '@/types';
import { CONTENT_SCHEMAS, detectSchemaVersion } from '@/types';
import { upgradeContentToV2 } from '@/lib/brand-material/normalize';

// v1 (legacy) — siguen montados tal cual, sin tocar.
import { ScheduleForm } from './ScheduleForm';
import { PromoForm }    from './PromoForm';
import { DataForm }     from './DataForm';
import { QuoteForm }    from './QuoteForm';
import { FreeForm }     from './FreeForm';

// v2 — bootstrap en useEffect si value no trae schema_version: 2.
import { ScheduleFormV2 } from './ScheduleFormV2';
import { PromoFormV2 }    from './PromoFormV2';
import { CatalogForm }    from './CatalogForm';
import { QuoteFormV2 }    from './QuoteFormV2';
import { FreeFormV2 }     from './FreeFormV2';

import { UpgradeToV2Banner } from '../UpgradeToV2Banner';

/**
 * Calcula si el content actual pasaría validación v2 en cliente.
 * Signalling no-authoritativo para deshabilitar "Guardar" en UI — el servidor
 * sigue siendo la autoridad.
 */
export function isContentValidV2(
  cat: BrandMaterialCategory,
  content: unknown,
): boolean {
  return CONTENT_SCHEMAS[cat].v2.safeParse(content).success;
}

export function CategoryForm({
  cat,
  value,
  onChange,
}: {
  cat:      BrandMaterialCategory;
  value:    Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const version = detectSchemaVersion(value);

  if (version === 2) {
    return renderV2(cat, value, onChange);
  }

  // v1: render form legacy intacto + banner arriba.
  function handleUpgrade() {
    const ok = typeof window !== 'undefined'
      ? window.confirm('Vas a actualizar este material al nuevo formato. Podrás editarlo antes de guardar. ¿Continuar?')
      : true;
    if (!ok) return;
    const upgraded = upgradeContentToV2(cat, value);
    onChange(upgraded as unknown as Record<string, unknown>);
  }

  return (
    <div>
      <UpgradeToV2Banner onUpgrade={handleUpgrade} />
      {renderV1(cat, value, onChange)}
    </div>
  );
}

function renderV1(
  cat: BrandMaterialCategory,
  value: Record<string, unknown>,
  onChange: (v: Record<string, unknown>) => void,
) {
  if (cat === 'schedule') return <ScheduleForm value={value} onChange={onChange} />;
  if (cat === 'promo')    return <PromoForm    value={value} onChange={onChange} />;
  if (cat === 'data')     return <DataForm     value={value} onChange={onChange} />;
  if (cat === 'quote')    return <QuoteForm    value={value} onChange={onChange} />;
  return <FreeForm value={value} onChange={onChange} />;
}

function renderV2(
  cat: BrandMaterialCategory,
  value: unknown,
  onChange: (v: Record<string, unknown>) => void,
) {
  const emit = (v: unknown) => onChange(v as Record<string, unknown>);
  if (cat === 'schedule') return <ScheduleFormV2 value={value} onChange={emit} />;
  if (cat === 'promo')    return <PromoFormV2    value={value} onChange={emit} />;
  if (cat === 'data')     return <CatalogForm    value={value} onChange={emit} />;
  if (cat === 'quote')    return <QuoteFormV2    value={value} onChange={emit} />;
  return <FreeFormV2 value={value} onChange={emit} />;
}
