'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export type TagChip = { key: string; label: string };

export const SEASON_CHIPS: TagChip[] = [
  { key: 'verano',         label: 'Verano' },
  { key: 'san_valentin',   label: 'San Valentín' },
  { key: 'vuelta_al_cole', label: 'Vuelta al cole' },
  { key: 'black_friday',   label: 'Black Friday' },
  { key: 'navidad',        label: 'Navidad' },
  { key: 'ano_nuevo',      label: 'Año Nuevo' },
  { key: 'primavera',      label: 'Primavera' },
  { key: 'halloween',      label: 'Halloween' },
];

export const FORMAT_CHIPS: TagChip[] = [
  { key: 'producto_hero',  label: 'Producto hero' },
  { key: 'flatlay',        label: 'Flatlay' },
  { key: 'testimonio',     label: 'Testimonio' },
  { key: 'before_after',   label: 'Antes/Después' },
  { key: 'making_of',      label: 'Making of' },
  { key: 'equipo',         label: 'Equipo' },
  { key: 'ambiente',       label: 'Ambiente' },
  { key: 'lanzamiento',    label: 'Lanzamiento' },
  { key: 'fidelizacion',   label: 'Fidelización' },
];

interface Props {
  selected: string[];
  onToggle: (key: string) => void;
}

function Chip({ chip, active, onToggle }: { chip: TagChip; active: boolean; onToggle: (k: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(chip.key)}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
        background: active ? '#0F766E' : '#fff',
        color: active ? '#fff' : '#374151',
        fontFamily: f,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {chip.label}
    </button>
  );
}

export function TagChipsBar({ selected, onToggle }: Props) {
  const hasSelected = selected.length > 0;

  return (
    <div style={{
      padding: '14px 0',
      marginBottom: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Temporadas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: fc,
          fontSize: 9,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#9ca3af',
          flexShrink: 0,
          width: 72,
        }}>
          Temporadas
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SEASON_CHIPS.map(c => (
            <Chip key={c.key} chip={c} active={selected.includes(c.key)} onToggle={onToggle} />
          ))}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: '#f3f4f6', margin: '0 0 0 82px' }} />

      {/* Formatos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: fc,
          fontSize: 9,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#9ca3af',
          flexShrink: 0,
          width: 72,
        }}>
          Formatos
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FORMAT_CHIPS.map(c => (
            <Chip key={c.key} chip={c} active={selected.includes(c.key)} onToggle={onToggle} />
          ))}
        </div>
      </div>

      {/* Clear all */}
      {hasSelected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 82 }}>
          <span style={{ fontFamily: f, fontSize: 11, color: '#6b7280' }}>
            {selected.length} filtro{selected.length > 1 ? 's' : ''} activo{selected.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => selected.forEach(k => onToggle(k))}
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 999,
              cursor: 'pointer',
              fontFamily: f,
              fontSize: 11,
              color: '#6b7280',
              padding: '2px 10px',
            }}
          >
            × Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
