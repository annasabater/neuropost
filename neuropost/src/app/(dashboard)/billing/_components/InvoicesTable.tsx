'use client';

import type { BillingInvoice } from '@/lib/billing/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts * 1000));
}

export default function InvoicesTable({ invoices }: { invoices: BillingInvoice[] }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: f }}>
        <thead>
          <tr>
            {['Factura', 'Fecha', 'Importe', 'Estado', ''].map((h, i) => (
              <th key={i} style={{
                textAlign: i === 4 ? 'right' : 'left',
                padding: '13px 20px', fontSize: 12, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--muted)', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                {inv.number ?? inv.id}
              </td>
              <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                {formatDate(inv.date)}
              </td>
              <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
              </td>
              <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                  background: inv.status === 'paid' ? 'var(--accent-light)' : '#FEF3C7',
                  color: inv.status === 'paid' ? 'var(--accent)' : '#92400E',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: inv.status === 'paid' ? 'var(--accent)' : '#F59E0B' }} />
                  {inv.status === 'paid' ? 'Pagada' : inv.status === 'open' ? 'Pendiente' : inv.status}
                </span>
              </td>
              <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                {inv.pdfUrl && (
                  <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                    PDF ↗
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
