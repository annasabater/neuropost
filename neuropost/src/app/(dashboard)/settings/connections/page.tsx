'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';

interface AccountStatus {
  accountId?:        string;
  pageId?:           string;
  username?:         string | null;
  pageName?:         string | null;
  tokenStatus:       'ok' | 'expiring_soon' | 'expired' | 'missing';
  daysLeft:          number | null;
  expiresAt:         string | null;
  tokenRefreshedAt?: string | null;
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [connecting, setConnecting] = useState(false);

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

  async function connectMeta(source: 'instagram' | 'facebook') {
    try {
      const res  = await fetch(`/api/meta/oauth-url?source=${source}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo iniciar la conexión con Meta');
      if (!json.url) throw new Error('Meta no devolvió una URL de autorización');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la conexión con Meta');
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setConfirmDisconnect(false);
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

  async function manualConnect() {
    if (!manualToken.trim()) { toast.error('Pega tu access token'); return; }
    setConnecting(true);
    try {
      const res = await fetch('/api/meta/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: manualToken.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Error al conectar'); return; }
      toast.success(
        `Conectado: ${json.facebook?.pageName ?? 'Facebook'}${json.instagram ? ` + @${json.instagram.username}` : ''}`
      );
      setManualToken('');
      setShowManual(false);
      fetchStatus();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setConnecting(false);
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
                <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
                  {status.instagram.username
                    ? `Cuenta: @${status.instagram.username}`
                    : `Cuenta: @${status.instagram.accountId}`}
                </p>
                {status.instagram.daysLeft !== null && (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Token válido {status.instagram.daysLeft > 0
                      ? `${status.instagram.daysLeft} días más`
                      : '(expirado)'}
                  </p>
                )}
                {status.instagram.tokenRefreshedAt && (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Última actualización: {new Date(status.instagram.tokenRefreshedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-outline" onClick={() => connectMeta('instagram')} style={{ alignSelf: 'flex-start' }}>
                    <RefreshCw size={14} /> Reconectar
                  </button>
                  <button type="button" className="btn-primary" onClick={() => connectMeta('instagram')} style={{ alignSelf: 'flex-start' }}>
                    <ExternalLink size={14} /> Conectar otra cuenta
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Necesitas una cuenta de Instagram Business o Creator vinculada a una página de Facebook.
                </p>
                <button type="button" className="btn-primary" onClick={() => connectMeta('instagram')}>
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
                <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
                  {status.facebook.pageName
                    ? `Página: ${status.facebook.pageName}`
                    : `Página ID: ${status.facebook.pageId}`}
                </p>
                {status.facebook.daysLeft !== null && (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Token válido {status.facebook.daysLeft > 0
                      ? `${status.facebook.daysLeft} días más`
                      : '(expirado)'}
                  </p>
                )}
                {status.facebook.tokenRefreshedAt && (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Última actualización: {new Date(status.facebook.tokenRefreshedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-outline" onClick={() => connectMeta('facebook')} style={{ alignSelf: 'flex-start' }}>
                    <RefreshCw size={14} /> Reconectar
                  </button>
                  <button type="button" className="btn-primary" onClick={() => connectMeta('facebook')} style={{ alignSelf: 'flex-start' }}>
                    <ExternalLink size={14} /> Conectar otra página
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Conecta con el mismo botón de Instagram — ambas cuentas se conectan juntas a través de Facebook Login.
                </p>
                <button type="button" className="btn-outline" onClick={() => connectMeta('facebook')}>
                  <ExternalLink size={14} /> Conectar mediante Facebook
                </button>
              </div>
            )}
          </div>

          {/* Manual connection */}
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>🔑</span>
              <h2 className="settings-section-title" style={{ margin: 0 }}>Conexión manual</h2>
            </div>

            {!showManual ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Si los botones de conectar no funcionan, puedes conectar manualmente con un token de Meta.
                </p>
                <button type="button" className="btn-outline" onClick={() => setShowManual(true)}>
                  Conectar con token manual
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--accent-bg, #f0fdfa)', border: '1px solid var(--accent)', padding: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 8 }}>Pasos:</p>
                  <ol style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                    <li>Ve a <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Graph API Explorer</a></li>
                    <li>Inicia sesión con tu cuenta de Facebook</li>
                    <li>En <strong>&quot;Meta App&quot;</strong> selecciona cualquier app (o crea una de prueba)</li>
                    <li>En <strong>&quot;Permissions&quot;</strong> añade: <code style={{ background: 'var(--bg-1)', padding: '1px 4px', fontSize: 11 }}>pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish</code></li>
                    <li>Pulsa <strong>&quot;Generate Access Token&quot;</strong> y acepta los permisos</li>
                    <li>Copia el token y pégalo aquí abajo</li>
                  </ol>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                    Access Token
                  </label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid var(--border)', fontSize: 13,
                      fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={manualConnect}
                    disabled={connecting}
                    style={{ opacity: connecting ? 0.5 : 1 }}
                  >
                    {connecting ? 'Conectando...' : 'Conectar'}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => { setShowManual(false); setManualToken(''); }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Disconnect all */}
          {anyConnected && (
            <div style={{ marginTop: 8 }}>
              {confirmDisconnect ? (
                <div style={{
                  border: '1px solid #fca5a5', background: '#fff7f7',
                  padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#991b1b', marginBottom: 4 }}>
                      ¿Desconectar Instagram y Facebook?
                    </p>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                      Las publicaciones programadas quedarán pendientes y no se publicarán automáticamente hasta que vuelvas a conectar.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-outline"
                      onClick={disconnect}
                      disabled={disconnecting}
                      style={{ color: '#dc2626', borderColor: '#dc2626', fontSize: 13 }}
                    >
                      <Trash2 size={13} />
                      {disconnecting ? 'Desconectando...' : 'Sí, desconectar'}
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => setConfirmDisconnect(false)}
                      style={{ fontSize: 13 }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-outline"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={disconnecting}
                  style={{ color: 'var(--red, #dc2626)', borderColor: 'var(--red, #dc2626)', fontSize: 13 }}
                >
                  <Trash2 size={13} />
                  Desconectar todas las cuentas
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
