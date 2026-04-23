'use client';

import type { BrandMaterialCategory } from '@/types';

const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface CategoryDef {
  id:    BrandMaterialCategory;
  label: string;
  desc:  string;
  icon:  string;
}

export function CategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: readonly CategoryDef[];
  active:     BrandMaterialCategory;
  onChange:   (id: BrandMaterialCategory) => void;
}) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 0 }}>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          style={{
            padding: '12px 20px',
            fontFamily: fc,
            fontWeight: 700,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: 'none',
            borderBottom: active === cat.id ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'none',
            color: active === cat.id ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            marginBottom: -1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
