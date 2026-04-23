'use client';

const f  = "var(--font-barlow), 'Barlow', sans-serif";

interface Props {
  score:        number;
  missingItems: string[];
}

export function BrandHealthScore({ score, missingItems }: Props) {
  const topMissing = missingItems.slice(0, 2).join(' y ');

  return (
    <div style={{
      background:  '#fff',
      border:      '1px solid #d4d4d8',
      borderRadius: 0,
      padding:     16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{
          fontFamily:    f,
          fontSize:      13,
          color:         '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Salud del brand kit
        </span>
        <span style={{
          fontFamily: f,
          fontSize:   20,
          fontWeight: 900,
          color:      '#111827',
        }}>
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width:        '100%',
        height:       4,
        background:   '#e5e7eb',
        borderRadius: 0,
        overflow:     'hidden',
      }}>
        <div style={{
          height:      '100%',
          width:       `${score}%`,
          background:  '#0F766E',
          transition:  'width 0.4s ease',
          borderRadius: 0,
        }} />
      </div>

      {/* Helper text */}
      {score < 100 && topMissing && (
        <p style={{
          fontFamily: f,
          fontSize:   12,
          color:      '#6b7280',
          margin:     '6px 0 0',
        }}>
          Mejora: {topMissing}
        </p>
      )}
    </div>
  );
}
