'use client';

import Link                    from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es }                  from 'date-fns/locale';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export interface AuditLogItem {
  id:          string;
  created_at:  string;
  actor_name?: string | null;
  description: string;
}

interface Props {
  items: AuditLogItem[];
}

export function BrandKitActivityFeed({ items }: Props) {
  return (
    <div style={{
      background:   '#fff',
      border:       '1px solid #d4d4d8',
      borderRadius: 0,
      padding:      '16px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontFamily:    fc,
          fontWeight:    700,
          fontSize:      13,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color:         '#111827',
        }}>
          Actividad reciente
        </span>
        <Link
          href="/brand-kit/history"
          style={{
            fontFamily:     f,
            fontSize:       12,
            color:          '#0F766E',
            textDecoration: 'none',
            fontWeight:     600,
          }}
        >
          Ver historial →
        </Link>
      </div>

      {items.length === 0 ? (
        <p style={{
          fontFamily: f,
          fontSize:   13,
          color:      '#6b7280',
          margin:     0,
        }}>
          Sin actividad reciente. Empieza editando cualquier sección arriba.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item, index) => {
            const relative = (() => {
              try {
                return formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es });
              } catch {
                return '';
              }
            })();

            const isLast = index === items.length - 1;

            return (
              <li
                key={item.id}
                style={{
                  fontFamily:   f,
                  fontSize:     13,
                  color:        '#111827',
                  padding:      '10px 0',
                  borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                  lineHeight:   1.4,
                }}
              >
                <span style={{ fontWeight: 600 }}>{item.actor_name || 'Sistema'}</span>
                {' '}{item.description}
                {relative && (
                  <span style={{ color: '#6b7280', marginLeft: 4 }}>· {relative}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
