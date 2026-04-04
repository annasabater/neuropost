import Link from 'next/link';
import { Mail, Megaphone } from 'lucide-react';
import { ProspectStatusBadge } from './ProspectStatusBadge';
import type { Prospect, ProspectChannel } from '@/lib/admin';

const CHANNEL_ICON: Record<ProspectChannel, React.ReactNode> = {
  instagram: <span style={{ fontSize: 12, lineHeight: 1 }}>📷</span>,
  email:     <Mail size={12} />,
  meta_ads:  <Megaphone size={12} />,
};

const CHANNEL_COLOR: Record<ProspectChannel, string> = {
  instagram: '#ff6b35',
  email:     '#60a5fa',
  meta_ads:  '#a78bfa',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 60)   return `hace ${m}min`;
  if (m < 1440) return `hace ${Math.floor(m / 60)}h`;
  return `hace ${Math.floor(m / 1440)}d`;
}

interface Props {
  prospect: Prospect;
  onConvert?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function ProspectCard({ prospect, onConvert, onArchive }: Props) {
  const chanColor = CHANNEL_COLOR[prospect.channel] ?? '#888';

  return (
    <div style={{
      background:   '#1a1917',
      border:       '1px solid #2a2927',
      borderRadius: 10,
      padding:      '14px 16px',
      display:      'flex',
      alignItems:   'center',
      gap:          12,
    }}>
      {/* Avatar placeholder */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: '#2a2927',
        backgroundImage: prospect.profile_pic_url ? `url(${prospect.profile_pic_url})` : 'none',
        backgroundSize: 'cover',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#555', flexShrink: 0,
      }}>
        {!prospect.profile_pic_url && (prospect.username?.[0]?.toUpperCase() ?? '?')}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e3db' }}>
            {prospect.username ? `@${prospect.username}` : prospect.full_name ?? '—'}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            color: chanColor, fontSize: 10, fontWeight: 700,
          }}>
            {CHANNEL_ICON[prospect.channel]} {prospect.channel === 'meta_ads' ? 'Ad' : prospect.channel}
          </span>
          <ProspectStatusBadge status={prospect.status} />
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
          {prospect.sector && <span style={{ marginRight: 8 }}>{prospect.sector}</span>}
          {prospect.city   && <span style={{ marginRight: 8 }}>📍 {prospect.city}</span>}
          {prospect.followers > 0 && <span>{fmt(prospect.followers)} seguidores</span>}
        </div>
      </div>

      {/* Last activity */}
      <div style={{ fontSize: 11, color: '#444', flexShrink: 0 }}>
        {timeAgo(prospect.last_activity)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Link
          href={`/captacion/prospects/${prospect.id}`}
          style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 12,
            background: '#2a2927', color: '#e8e3db', textDecoration: 'none',
          }}
        >
          Ver ficha
        </Link>
        {onConvert && prospect.status !== 'converted' && (
          <button
            onClick={() => onConvert(prospect.id)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12,
              background: 'rgba(74,222,128,0.15)', color: '#4ade80',
              border: 'none', cursor: 'pointer',
            }}
          >
            ✓
          </button>
        )}
        {onArchive && (
          <button
            onClick={() => onArchive(prospect.id)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12,
              background: 'rgba(255,255,255,0.05)', color: '#555',
              border: 'none', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
