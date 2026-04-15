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
  // TODO [FASE 2]: Facebook — add facebook: AccountStatus | null
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

  /** Flujo directo con Instagram (sin Facebook) */
  async function connectInstagram() {
    try {
      const res  = await fetch('/api/meta/instagram-auth-url');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo iniciar la conexión con Instagram');
      if (!json.url) throw new Error('Instagram no devolvió una URL de autorización');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la conexión con Instagram');
    }
  }

  /** Flujo via Facebook (requiere Página de Facebook vinculada) */
  async function connectMeta() {
    try {
      const res  = await fetch('/api/meta/oauth-url?source=instagram');
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
        json.instagram ? `Conectado: @${json.instagram.username}` : 'Instagram conectado correctamente'
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

  const anyConnected = status?.instagram;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Conexiones</h1>
          <p className="page-sub">Conecta tu Instagram para publicar fotos, vídeos, reels, carruseles e historias</p>
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
              <h2 className="settings-section-title" style={{ margin: 0 }}>Instagram</h2>
              {status?.instagram && <StatusBadge status={status.instagram.tokenStatus} />}
            </div>

            {status?.instagram ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
                  {status.instagram.username
                    ? `@${status.instagram.username}`
                    : `ID: ${status.instagram.accountId}`}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {['Fotos', 'Vídeos', 'Reels', 'Carruseles'].map((t) => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#e6f9f0', color: '#1a7a45' }}>{t}</span>
                  ))}
                </div>
                {status.instagram.daysLeft !== null && (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Token válido {status.instagram.daysLeft > 0
                      ? `${status.instagram.daysLeft} días más`
                      : '(expirado — reconecta)'}
                  </p>
                )}
                {status.instagram.tokenRefreshedAt && (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Última actualización: {new Date(status.instagram.tokenRefreshedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <button type="button" className="btn-outline" onClick={() => connectInstagram()} style={{ alignSelf: 'flex-start' }}>
                    <RefreshCw size={14} /> Reconectar
                  </button>
                  <button type="button" className="btn-primary" onClick={() => connectInstagram()} style={{ alignSelf: 'flex-start' }}>
                    <ExternalLink size={14} /> Cambiar cuenta
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                  Conecta tu cuenta para que NeuroPost pueda publicar en tu nombre:
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {['Fotos', 'Vídeos', 'Reels', 'Carruseles'].map((t) => (
                    <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', background: 'var(--bg-1)', color: 'var(--ink)', border: '1px solid var(--border)' }}>{t}</span>
                  ))}
                </div>

                {/* Opción principal: Instagram Login directo */}
                <div style={{
                  border: '2px solid var(--accent, #0D9488)',
                  padding: '16px 20px',
                  marginBottom: 12,
                }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                    Conectar con Instagram
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
                    Solo necesitas tu cuenta de Instagram. Debe ser Business o Creator — puedes cambiarlo gratis desde la app de Instagram.
                  </p>
                  <button type="button" className="btn-primary" onClick={() => connectInstagram()}>
                    <ExternalLink size={14} /> Conectar con Instagram
                  </button>
                </div>

                {/* Opción alternativa: via Facebook */}
                <div style={{
                  border: '1px solid var(--border)',
                  padding: '14px 16px',
                  background: 'var(--bg-1)',
                }}>
                  <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                    Conectar via Facebook
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                    Si gestionas tu Instagram desde una Página de Facebook.
                  </p>
                  <button type="button" className="btn-outline" onClick={() => connectMeta()} style={{ fontSize: 12 }}>
                    <ExternalLink size={13} /> Conectar con Facebook
                  </button>
                </div>
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
                      ¿Desconectar Instagram?
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
