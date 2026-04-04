import type { ProspectStatus } from '@/lib/admin';

const MAP: Record<ProspectStatus, { label: string; bg: string; color: string }> = {
  contacted:     { label: 'Contactado',   bg: '#2a2927', color: '#888' },
  replied:       { label: 'Respondió',    bg: '#2d2a00', color: '#f5a623' },
  interested:    { label: 'Interesado',   bg: '#2d1500', color: '#ff6b35' },
  converted:     { label: 'Convertido',   bg: '#0d2a1a', color: '#4ade80' },
  not_interested:{ label: 'No interesa',  bg: '#1f1f1f', color: '#555' },
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  const s = MAP[status] ?? MAP.contacted;
  return (
    <span style={{
      background:   s.bg,
      color:        s.color,
      padding:      '3px 10px',
      borderRadius: 20,
      fontSize:     11,
      fontWeight:   700,
      whiteSpace:   'nowrap',
    }}>
      {s.label}
    </span>
  );
}
