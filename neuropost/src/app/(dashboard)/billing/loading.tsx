export default function BillingLoading() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ height: 20, width: 120, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
      <div style={{ height: 44, width: 320, background: 'var(--border)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 16, width: 480, background: 'var(--border)', borderRadius: 4, marginBottom: 36 }} />
      <div style={{ height: 240, background: 'var(--border)', borderRadius: 14, marginBottom: 48, opacity: 0.5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: 360, background: 'var(--border)', borderRadius: 14, opacity: 0.3 }} />)}
      </div>
    </div>
  );
}
