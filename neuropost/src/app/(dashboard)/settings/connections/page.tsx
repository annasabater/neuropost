'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface AccountStatus {
  accountId?:        string;
  pageId?:           string;
  username?:         string | null;
  pageName?:         string | null;
  openId?:           string;
  tokenStatus:       'ok' | 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'unknown';
  daysLeft:          number | null;
  expiresAt:         string | null;
  tokenRefreshedAt?: string | null;
}

interface ConnectionStatus {
  instagram: AccountStatus | null;
  facebook:  AccountStatus | null;
  tiktok:    AccountStatus | null;
}

function StatusBadge({ status }: { status: AccountStatus['tokenStatus'] }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ok:            { label: 'Conectado',     bg: '#e6f9f0', color: '#1a7a45' },
    valid:         { label: 'Conectado',     bg: '#e6f9f0', color: '#1a7a45' },
    expiring_soon: { label: 'Expira pronto', bg: '#fff8e1', color: '#b45309' },
    expired:       { label: 'Token expirado',bg: '#fff0f0', color: '#dc2626' },
    missing:       { label: 'Sin conectar',  bg: '#f5f5f5', color: '#777' },
    unknown:       { label: 'Sin conectar',  bg: '#f5f5f5', color: '#777' },
  };
  const s = map[status] ?? map.missing;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', fontSize: 11, fontWeight: 700, fontFamily: f }}>
      {s.label}
    </span>
  );
}

function PlatformCard({
  emoji, name, description, capabilities, connected, status,
  onConnect, onDisconnect, connectLabel, connectNote,
}: {
  emoji: string;
  name: string;
  description: string;
  capabilities: string[];
  connected: boolean;
  status: AccountStatus | null;
  onConnect: () => void;
  onDisconnect: () => void;
  connectLabel: string;
  connectNote?: string;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="settings-section" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: connected ? 16 : 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
        <h2 className="settings-section-title" style={{ margin: 0, fontFamily: fc }}>{name}</h2>
        {status && <StatusBadge status={status.tokenStatus} />}
      </div>

      {connected && status ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Account info */}
          <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, fontFamily: f }}>
            {status.username ? `@${status.username}` : status.pageName ?? status.pageId ?? status.openId ?? 'Conectado'}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {capabilities.map((c) => (
              <span key={c} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#e6f9f0', color: '#1a7a45', fontFamily: f }}>{c}</span>
            ))}
          </div>
          {status.daysLeft !== null && (
            <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: f }}>
              Token válido {status.daysLeft > 0 ? `${status.daysLeft} días más` : '(expirado — reconecta)'}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <button type="button" className="btn-outline" onClick={onConnect}>
              <RefreshCw size={14} /> Reconectar
            </button>
            {!confirm ? (
              <button type="button" className="btn-outline" onClick={() => setConfirm(true)}
                style={{ color: '#dc2626', borderColor: '#dc2626', fontSize: 13 }}>
                <Trash2 size={13} /> Desconectar
              </button>
            ) : (
              <>
                <button type="button" className="btn-outline" onClick={() => { onDisconnect(); setConfirm(false); }}
                  style={{ color: '#dc2626', borderColor: '#dc2626', fontSize: 13 }}>
                  Sí, desconectar
                </button>
                <button type="button" className="btn-outline" onClick={() => setConfirm(false)} style={{ fontSize: 13 }}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10, fontFamily: f }}>{description}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {capabilities.map((c) => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', background: 'var(--bg-1)', color: 'var(--ink)', border: '1px solid var(--border)', fontFamily: f }}>{c}</span>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={onConnect}>
            <ExternalLink size={14} /> {connectLabel}
          </button>
          {connectNote && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, fontFamily: f }}>{connectNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  const [status,  setStatus]  = useState<ConnectionStatus>({ instagram: null, facebook: null, tiktok: null });
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const [metaRes, ttRes] = await Promise.all([
        fetch('/api/meta/status'),
        fetch('/api/tiktok/status'),
      ]);
      const meta = await metaRes.json() as { instagram?: AccountStatus | null; facebook?: AccountStatus | null };
      const tt   = await ttRes.json()  as { connected?: boolean; username?: string; openId?: string; daysLeft?: number; tokenStatus?: string };

      setStatus({
        instagram: meta.instagram ?? null,
        facebook:  meta.facebook  ?? null,
        tiktok:    tt.connected
          ? { openId: tt.openId, username: tt.username, tokenStatus: (tt.tokenStatus ?? 'valid') as AccountStatus['tokenStatus'], daysLeft: tt.daysLeft ?? null, expiresAt: null }
          : null,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function connectInstagram() {
    try {
      const res = await fetch('/api/meta/instagram-auth-url');
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'No se pudo iniciar la conexión con Instagram');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar Instagram');
    }
  }

  async function connectFacebook() {
    try {
      const res = await fetch('/api/meta/oauth-url?source=facebook');
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'No se pudo iniciar la conexión con Facebook');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar Facebook');
    }
  }

  async function connectTikTok() {
    try {
      const res = await fetch('/api/tiktok/auth-url');
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'No se pudo iniciar la conexión con TikTok');
      window.location.href = json.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar TikTok');
    }
  }

  async function disconnectMeta() {
    await fetch('/api/meta/status', { method: 'DELETE' });
    toast.success('Instagram y Facebook desconectados');
    fetchStatus();
  }

  async function disconnectTikTok() {
    await fetch('/api/tiktok/status', { method: 'DELETE' });
    toast.success('TikTok desconectado');
    fetchStatus();
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
      const json = await res.json() as { instagram?: { username?: string }; error?: string };
      if (!res.ok) { toast.error(json.error ?? 'Error al conectar'); return; }
      toast.success(json.instagram?.username ? `Conectado: @${json.instagram.username}` : 'Instagram conectado');
      setManualToken('');
      setShowManual(false);
      fetchStatus();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Conexiones</h1>
          <p className="page-sub">Conecta tus redes sociales para publicar directamente desde NeuroPost</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontFamily: f }}>Cargando estado de conexiones...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Instagram */}
          <PlatformCard
            emoji="📷" name="Instagram"
            description="Conecta tu cuenta Business o Creator para publicar fotos, vídeos y reels."
            capabilities={['Fotos', 'Vídeos', 'Reels', 'Carruseles', 'Historias']}
            connected={!!status.instagram}
            status={status.instagram}
            onConnect={connectInstagram}
            onDisconnect={disconnectMeta}
            connectLabel="Conectar con Instagram"
            connectNote="Necesitas cuenta Business o Creator (puedes cambiarlo gratis desde la app de Instagram)."
          />

          {/* Facebook */}
          <PlatformCard
            emoji="📘" name="Facebook"
            description="Conecta tu Página de Facebook para publicar fotos y vídeos directamente."
            capabilities={['Fotos', 'Vídeos', 'Posts de texto']}
            connected={!!status.facebook}
            status={status.facebook}
            onConnect={connectFacebook}
            onDisconnect={disconnectMeta}
            connectLabel="Conectar con Facebook"
            connectNote="Necesitas ser administrador de una Página de Facebook (no perfil personal)."
          />

          {/* TikTok */}
          <PlatformCard
            emoji="🎵" name="TikTok"
            description="Conecta tu cuenta de TikTok para publicar vídeos directamente. Solo compatible con el formato Reel."
            capabilities={['Vídeos', 'Reels']}
            connected={!!status.tiktok}
            status={status.tiktok}
            onConnect={connectTikTok}
            onDisconnect={disconnectTikTok}
            connectLabel="Conectar con TikTok"
            connectNote="Solo se pueden publicar vídeos (no fotos ni carruseles). La cuenta debe ser Business o Creator."
          />

          {/* Manual connection */}
          <div className="settings-section" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>🔑</span>
              <h2 className="settings-section-title" style={{ margin: 0, fontFamily: fc }}>Conexión manual (Meta)</h2>
            </div>

            {!showManual ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontFamily: f }}>
                  Si los botones de conectar no funcionan, puedes conectar manualmente con un token de Meta.
                </p>
                <button type="button" className="btn-outline" onClick={() => setShowManual(true)}>
                  Conectar con token manual
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--accent-bg, #f0fdfa)', border: '1px solid var(--accent)', padding: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 8, fontFamily: f }}>Pasos:</p>
                  <ol style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, paddingLeft: 16, margin: 0, fontFamily: f }}>
                    <li>Ve a <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Graph API Explorer</a></li>
                    <li>Inicia sesión y selecciona tu app</li>
                    <li>Añade permisos: <code style={{ background: 'var(--bg-1)', padding: '1px 4px', fontSize: 11 }}>pages_show_list, pages_manage_posts, instagram_basic, instagram_content_publish</code></li>
                    <li>Pulsa <strong>&quot;Generate Access Token&quot;</strong> y copia el token</li>
                  </ol>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block', fontFamily: f }}>Access Token</label>
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-primary" onClick={manualConnect} disabled={connecting} style={{ opacity: connecting ? 0.5 : 1 }}>
                    {connecting ? 'Conectando...' : 'Conectar'}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => { setShowManual(false); setManualToken(''); }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
