'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';

interface AccountStatus {
  accountId?:  string;
  pageId?:     string;
  username?:   string | null;
  pageName?:   string | null;
  tokenStatus: 'ok' | 'expiring_soon' | 'expired' | 'missing';
  daysLeft:    number | null;
  expiresAt:   string | null;
}

interface ConnectionStatus {
  instagram: AccountStatus | null;
  facebook:  AccountStatus | null;
}

function StatusBadge({ status }: { status: AccountStatus['tokenStatus'] }) {
  const map = {
    ok:            { label: 'Conectado',    bg: '#e6f9f0', color: '#1a7a45' },
    expiring_soon: { label: 'Expira pronto', bg: '#fff8e1', color: '#b45309' },
    expired:       { label: 'Token expirado', bg: '#fff0f0', color: '#dc2626' },
    missing:       { label: 'Sin conectar',  bg: '#f5f5f5', color: '#777' },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

export default function ConnectionsPage() {
  const [status,  setStatus]  = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res  = await fetch('/api/meta/status');
      const json = await res.json();
      setStatus(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function connectMeta() {
    const res  = await fetch('/api/meta/oauth-url');
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  }

  async function disconnect() {
    if (!confirm('¿Seguro que quieres desconectar tus cuentas de Instagram y Facebook?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/meta/status', { method: 'DELETE' });
      toast.success('Cuentas desconectadas');
      fetchStatus();
    } catch {
      toast.error('Error al desconectar');
    } finally {
      setDisconnecting(false);
    }
  }

  const anyConnected = status?.instagram || status?.facebook;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Conexiones</h1>
          <p className="page-sub">Conecta tus cuentas de Instagram y Facebook</p>
        </div>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--muted)' }}>← Ajustes</Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Cargando estado de conexiones...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Instagram */}
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: status?.instagram ? 16 : 0 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>📷</span>
              <h2 className="settings-section-title" style={{ margin: 0 }}>Instagram Business</h2>
              {status?.instagram && <StatusBadge status={status.instagram.tokenStatus} />}
            </div>

            {status?.instagram ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {status.instagram.username ? `@${status.instagram.username}` : `ID: ${status.instagram.accountId}`}
                </p>
                {status.instagram.daysLeft !== null && (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Token válido {status.instagram.daysLeft > 0
                      ? `${status.instagram.daysLeft} días más`
                      : '(expirado)'}
                  </p>
                )}
                <button className="btn-outline" onClick={connectMeta} style={{ alignSelf: 'flex-start' }}>
                  <RefreshCw size={14} /> Reconectar
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Necesitas una cuenta de Instagram Business o Creator vinculada a una página de Facebook.
                </p>
                <button className="btn-primary" onClick={connectMeta}>
                  <ExternalLink size={14} /> Conectar Instagram
                </button>
              </div>
            )}
          </div>

          {/* Facebook */}
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: status?.facebook ? 16 : 0 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>👍</span>
              <h2 className="settings-section-title" style={{ margin: 0 }}>Facebook Page</h2>
              {status?.facebook && <StatusBadge status={status.facebook.tokenStatus} />}
            </div>

            {status?.facebook ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {status.facebook.pageName ?? `Página ID: ${status.facebook.pageId}`}
                </p>
                <button className="btn-outline" onClick={connectMeta} style={{ alignSelf: 'flex-start' }}>
                  <RefreshCw size={14} /> Reconectar
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Conecta con el mismo botón de Instagram — ambas cuentas se conectan juntas a través de Facebook Login.
                </p>
                <button className="btn-outline" onClick={connectMeta}>
                  <ExternalLink size={14} /> Conectar mediante Facebook
                </button>
              </div>
            )}
          </div>

          {/* Disconnect all */}
          {anyConnected && (
            <div style={{ marginTop: 8 }}>
              <button
                className="btn-outline"
                onClick={disconnect}
                disabled={disconnecting}
                style={{ color: 'var(--red, #dc2626)', borderColor: 'var(--red, #dc2626)', fontSize: 13 }}
              >
                <Trash2 size={13} />
                {disconnecting ? 'Desconectando...' : 'Desconectar todas las cuentas'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
