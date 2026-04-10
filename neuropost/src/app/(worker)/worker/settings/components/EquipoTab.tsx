'use client';

import { useEffect, useState } from 'react';
import { Trash2, Users, UserPlus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#dc2626',
};

interface TeamWorker {
  id: string;
  email: string;
  name: string | null;
  role: 'worker' | 'senior' | 'admin';
  is_active: boolean;
  joined_at: string;
  added_by: string | null;
  is_me: boolean;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(months / 12)} año${Math.floor(months / 12) > 1 ? 's' : ''}`;
}

export default function EquipoTab() {
  const [workers, setWorkers] = useState<TeamWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamWorker | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/worker/team');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setWorkers(data.workers ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar el equipo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!email.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/worker/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      toast.success(data.reactivated ? 'Trabajador reactivado' : 'Trabajador añadido');
      setEmail('');
      setShowAdd(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(w: TeamWorker) {
    try {
      const res = await fetch(`/api/worker/team/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !w.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      toast.success(w.is_active ? 'Desactivado' : 'Activado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/worker/team/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      toast.success('Trabajador eliminado del equipo');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  }

  const activeCount = workers.filter((w) => w.is_active).length;
  const inactiveCount = workers.length - activeCount;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, fontFamily: f, color: C.text }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fc, fontSize: 28, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0, marginBottom: 6 }}>
            Equipo
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
            Trabajadores con acceso al portal <code style={{ background: C.bg1, padding: '2px 6px', fontSize: 12 }}>/worker</code>.
            Solo quienes están aquí pueden entrar.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: '12px 22px',
            background: C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            fontFamily: fc,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <UserPlus size={16} /> Añadir trabajador
        </button>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, border: `1px solid ${C.border}`, marginBottom: 24 }}>
        <StatCard label="Total" value={workers.length} />
        <StatCard label="Activos" value={activeCount} accent={C.accent} />
        <StatCard label="Inactivos" value={inactiveCount} muted />
      </div>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card ?? C.bg, border: `1px solid ${C.border}` }}>
          Cargando equipo…
        </div>
      ) : workers.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 110px', gap: 0, background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fc }}>
            <div>Trabajador</div>
            <div>Rol</div>
            <div>Añadido</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {workers.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 140px 110px',
                gap: 0,
                padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                alignItems: 'center',
                background: w.is_active ? C.bg : C.bg1,
                opacity: w.is_active ? 1 : 0.65,
                transition: 'background 0.15s',
              }}
            >
              {/* Trabajador */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: w.is_active ? C.accent : C.muted,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    fontFamily: fc,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {(w.name ?? w.email).charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.name ?? w.email}
                    </span>
                    {w.is_me && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: C.accent2, color: '#fff', padding: '2px 6px', fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tú
                      </span>
                    )}
                  </div>
                  {w.name && (
                    <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Rol */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: w.role === 'admin' ? C.accent : C.bg1,
                    color: w.role === 'admin' ? '#fff' : C.muted,
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: fc,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    border: w.role === 'admin' ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  {w.role}
                </span>
              </div>

              {/* Añadido */}
              <div style={{ fontSize: 12, color: C.muted }}>{relativeTime(w.joined_at)}</div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {!w.is_me && (
                  <>
                    <button
                      onClick={() => handleToggle(w)}
                      title={w.is_active ? 'Desactivar' : 'Activar'}
                      style={{
                        padding: '6px 10px',
                        background: w.is_active ? C.bg : C.accent,
                        color: w.is_active ? C.muted : '#fff',
                        border: `1px solid ${w.is_active ? C.border : C.accent}`,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: fc,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {w.is_active ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(w)}
                      title="Eliminar del equipo"
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        color: C.red,
                        border: `1px solid ${C.red}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal añadir ─────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setEmail(''); }}>
          <div style={{ padding: 32, width: 480, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={18} color="#fff" />
              </div>
              <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Añadir trabajador
              </h2>
            </div>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 22px', lineHeight: 1.5 }}>
              El trabajador debe haberse registrado antes en <code style={{ background: C.bg1, padding: '1px 5px' }}>/signup</code>.
              Al añadirlo aquí le das acceso inmediato al portal <code style={{ background: C.bg1, padding: '1px 5px' }}>/worker</code>.
            </p>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Email del trabajador
            </label>
            <input
              type="email"
              placeholder="trabajador@neuropost.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                border: `1px solid ${C.border}`,
                background: C.bg,
                fontSize: 14,
                fontFamily: f,
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 14,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.accent; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: C.bg2, border: `1px solid ${C.accent2}`, marginBottom: 22 }}>
              <CheckCircle2 size={14} color={C.accent} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.text }}>
                Se añadirá como <strong>admin</strong> con acceso completo al portal.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAdd(false); setEmail(''); }}
                style={{
                  padding: '12px 22px',
                  background: 'transparent',
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  fontFamily: fc,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!email.trim() || saving}
                style={{
                  padding: '12px 26px',
                  background: C.accent,
                  color: '#fff',
                  border: 'none',
                  cursor: !email.trim() || saving ? 'not-allowed' : 'pointer',
                  opacity: !email.trim() || saving ? 0.5 : 1,
                  fontFamily: fc,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 12,
                }}
              >
                {saving ? 'Añadiendo…' : 'Añadir al equipo'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal confirmar eliminar ─────────────────────────────────────── */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div style={{ padding: 32, width: 440, maxWidth: '92vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={18} color="#fff" />
              </div>
              <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                ¿Eliminar trabajador?
              </h2>
            </div>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px', lineHeight: 1.5 }}>
              <strong style={{ color: C.text }}>{confirmDelete.name ?? confirmDelete.email}</strong> perderá el acceso al portal
              inmediatamente. Podrás volver a añadirlo más adelante si hace falta.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '12px 22px',
                  background: 'transparent',
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  cursor: 'pointer',
                  fontFamily: fc,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '12px 22px',
                  background: C.red,
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: fc,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────

function StatCard({ label, value, accent, muted }: { label: string; value: number; accent?: string; muted?: boolean }) {
  return (
    <div style={{ background: C.bg, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: fc, fontSize: 34, fontWeight: 900, color: muted ? C.muted : accent ?? C.text, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, background: C.bg1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <Users size={28} color={C.muted} />
      </div>
      <h3 style={{ fontFamily: fc, fontSize: 20, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        Aún no hay trabajadores
      </h3>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
        Añade a tu primer trabajador por email. Debe haberse registrado antes en <code style={{ background: C.bg1, padding: '1px 5px' }}>/signup</code>.
      </p>
      <button
        onClick={onAdd}
        style={{
          padding: '12px 24px',
          background: C.accent,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: fc,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <UserPlus size={14} /> Añadir primer trabajador
      </button>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: C.muted,
            padding: 6,
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
