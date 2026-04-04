'use client';

interface SeasonalPinProps {
  name:     string;
  type:     'national' | 'sector' | 'seasonal';
  hasPost:  boolean;
  onClick?: () => void;
}

const COLORS = {
  national: '#f87171',  // red
  sector:   '#ff6b35',  // orange
  seasonal: '#4ade80',  // green
};

export function SeasonalPin({ name, type, hasPost, onClick }: SeasonalPinProps) {
  const color = COLORS[type];

  return (
    <div
      title={`${name}${hasPost ? ' ✓ Post listo' : ' — Sin post'}`}
      onClick={onClick}
      style={{
        position:   'absolute',
        top:        2,
        right:      2,
        width:      7,
        height:     7,
        borderRadius: '50%',
        background: hasPost ? '#4ade80' : color,
        border:     hasPost ? '1px solid #166534' : `1px solid ${color}`,
        cursor:     onClick ? 'pointer' : 'default',
        zIndex:     10,
        flexShrink: 0,
      }}
    />
  );
}

export function SeasonalChip({ name, daysUntil, hasPost, onGenerate }: {
  name:        string;
  daysUntil:   number;
  hasPost:     boolean;
  onGenerate?: () => void;
}) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '8px 12px',
      borderRadius:   8,
      background:     hasPost ? 'rgba(74,222,128,0.08)' : 'rgba(255,107,53,0.08)',
      border:         `1px solid ${hasPost ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,53,0.2)'}`,
      marginBottom:   8,
    }}>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
          en {daysUntil} día{daysUntil !== 1 ? 's' : ''}
        </span>
      </div>
      {hasPost ? (
        <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Post listo ✓</span>
      ) : (
        <button
          onClick={onGenerate}
          style={{ fontSize: 11, color: '#ff6b35', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
        >
          Crear →
        </button>
      )}
    </div>
  );
}
