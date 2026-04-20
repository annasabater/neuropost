'use client';

/**
 * Visual progress bar showing the lifecycle of a post/request.
 *
 * Usage:
 *   <StatusProgressBar currentStatus="processing" />
 *
 * Renders:
 *   [Recibida] → [En cola] → [Procesando] → [Revisión] → [Entregada] → [Aprobada] → [Publicada]
 *       ●            ●           ◐              ○             ○              ○             ○
 */

const f = "var(--font-barlow), 'Barlow', sans-serif";

const STEPS = [
  { key: 'request',          label: 'Recibida',   icon: '📩' },
  { key: 'pending',          label: 'En cola',    icon: '⚙️' },
  { key: 'generating',       label: 'Procesando', icon: '🔄' },
  { key: 'review',           label: 'Revisión',   icon: '✅' },
  { key: 'delivered',        label: 'Entregada',  icon: '📤' },
  { key: 'approved',         label: 'Aprobada',   icon: '👍' },
  { key: 'published',        label: 'Publicada',  icon: '🚀' },
] as const;

// Map actual DB statuses to our progress step keys
const STATUS_MAP: Record<string, string> = {
  request:             'request',
  draft:               'request',
  generated:           'review',
  pending:             'review',
  needs_human_review:  'review',
  approved:            'approved',
  scheduled:           'approved',
  published:           'published',
  failed:              'generating',   // stuck at processing
  cancelled:           'request',
  // Agent job statuses
  'pending_agent':     'pending',
  running:             'generating',
  done:                'delivered',
  error:               'generating',
  claimed:             'generating',
};

interface Props {
  currentStatus: string;
  hasError?: boolean;
  compact?: boolean;
}

export function StatusProgressBar({ currentStatus, hasError = false, compact = false }: Props) {
  const mappedKey = STATUS_MAP[currentStatus] ?? currentStatus;
  const currentIdx = STEPS.findIndex(s => s.key === mappedKey);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {STEPS.map((step, i) => {
          const isPast    = i < activeIdx;
          const isCurrent = i === activeIdx;
          const bg = hasError && isCurrent ? '#dc2626'
            : isPast || isCurrent ? '#0F766E' : '#e5e7eb';
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 8, height: 8,
                background: bg,
                opacity: isCurrent ? 1 : isPast ? 0.7 : 0.3,
              }} title={step.label} />
              {i < STEPS.length - 1 && (
                <div style={{ width: 12, height: 1, background: isPast ? '#0F766E' : '#e5e7eb' }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {STEPS.map((step, i) => {
        const isPast    = i < activeIdx;
        const isCurrent = i === activeIdx;
        const isFuture  = i > activeIdx;
        const dotBg = hasError && isCurrent ? '#dc2626'
          : isPast || isCurrent ? '#0F766E' : '#e5e7eb';
        const textColor = isCurrent ? '#0F766E' : isPast ? '#6b7280' : '#d1d5db';

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            {/* Step dot + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
              <div style={{
                width: isCurrent ? 14 : 10,
                height: isCurrent ? 14 : 10,
                background: dotBg,
                transition: 'all 0.2s',
              }} />
              <span style={{
                fontFamily: f, fontSize: 9, fontWeight: isCurrent ? 700 : 400,
                color: textColor, marginTop: 4, textAlign: 'center',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1, minWidth: 8,
                background: isPast ? '#0F766E' : '#e5e7eb',
                marginBottom: 16,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
