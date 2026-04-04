interface SkeletonProps {
  width?:        string;
  height?:       string;
  borderRadius?: string;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px' }: SkeletonProps) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background:     'linear-gradient(90deg, var(--border) 25%, var(--warm) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation:      'shimmer 1.5s infinite',
      flexShrink:     0,
    }} />
  );
}

export function SkeletonPostCard() {
  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 12,
      padding:      16,
      display:      'flex',
      gap:          12,
    }}>
      <Skeleton width="52px" height="52px" borderRadius="8px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="70%" height="13px" />
        <Skeleton width="40%" height="11px" />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width="60px" height="20px" borderRadius="40px" />
          <Skeleton width="60px" height="20px" borderRadius="40px" />
        </div>
      </div>
      <Skeleton width="48px" height="13px" borderRadius="6px" />
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 12,
      padding:      20,
      display:      'flex',
      alignItems:   'center',
      gap:          14,
    }}>
      <Skeleton width="22px" height="22px" borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="55%" height="11px" />
        <Skeleton width="35%" height="24px" borderRadius="6px" />
      </div>
    </div>
  );
}

export function SkeletonCalendarCell() {
  return (
    <div style={{ padding: 8 }}>
      <Skeleton width="24px" height="13px" borderRadius="4px" />
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Skeleton width="100%" height="20px" borderRadius="4px" />
        <Skeleton width="75%"  height="20px" borderRadius="4px" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width="260px" height="32px" borderRadius="8px" />
          <Skeleton width="160px" height="14px" />
        </div>
        <Skeleton width="120px" height="40px" borderRadius="40px" />
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[...Array(3)].map((_, i) => <SkeletonMetricCard key={i} />)}
      </div>

      {/* Quick actions */}
      <Skeleton width="140px" height="18px" borderRadius="6px" />
      <div className="quick-actions" style={{ marginTop: 14, marginBottom: 28 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Skeleton width="24px" height="24px" borderRadius="50%" />
            <Skeleton width="60px" height="12px" />
          </div>
        ))}
      </div>

      {/* Recent posts */}
      <Skeleton width="120px" height="18px" borderRadius="6px" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {[...Array(4)].map((_, i) => <SkeletonPostCard key={i} />)}
      </div>
    </div>
  );
}
