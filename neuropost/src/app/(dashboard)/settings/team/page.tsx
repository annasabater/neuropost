'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Crown } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { TeamMember, TeamRole } from '@/types';

const ROLES: { value: TeamRole; label: string; desc: string }[] = [
  { value: 'admin',    label: 'Admin',    desc: 'Acceso total excepto facturación' },
  { value: 'editor',   label: 'Editor',   desc: 'Crear y editar posts' },
  { value: 'approver', label: 'Aprobador', desc: 'Aprobar posts para publicar' },
  { value: 'analyst',  label: 'Analista', desc: 'Ver métricas y reportes' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Invitación pendiente',
  active:  'Activo',
};

export default function TeamPage() {
  const brand   = useAppStore((s) => s.brand);
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [email,   setEmail]     = useState('');
  const [role,    setRole]      = useState<TeamRole>('editor');
  const [inviting, setInviting] = useState(false);

  async function fetchMembers() {
    const res  = await fetch('/api/team/invite');
    const json = await res.json();
    setMembers(json.members ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchMembers(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      toast.success(`Invitación enviada a ${email}`);
      setEmail('');
      fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('¿Eliminar a este miembro del equipo?')) return;
    try {
      await fetch('/api/team/invite', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberId }),
      });
      toast.success('Miembro eliminado');
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      toast.error('Error al eliminar');
    }
  }

  if (brand?.plan === 'starter') {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Equipo</h1>
            <p className="page-sub">Gestiona los miembros de tu equipo</p>
          </div>
          <Link href="/settings" style={{ fontSize: 13, color: 'var(--muted)' }}>← Ajustes</Link>
        </div>
        <div className="settings-section" style={{ textAlign: 'center', padding: 40 }}>
          <Crown size={40} style={{ color: 'var(--orange)', margin: '0 auto 16px' }} />
          <p style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            Función de plan Pro
          </p>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            La gestión de equipo está disponible en los planes Pro y Agency.
          </p>
          <Link href="/settings/plan" className="btn-primary">Ver planes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Equipo</h1>
          <p className="page-sub">Invita colaboradores para gestionar tu marca</p>
        </div>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--muted)' }}>← Ajustes</Link>
      </div>

      {/* Invite form */}
      <div className="settings-section">
        <h2 className="settings-section-title">Invitar miembro</h2>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label>Email</label>
            <input
              type="email"
              placeholder="colaborador@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ flex: '0 0 160px', marginBottom: 0 }}>
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={inviting} style={{ alignSelf: 'flex-end' }}>
            {inviting ? <><span className="loading-spinner" />Invitando...</> : <><UserPlus size={14} />Invitar</>}
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          {ROLES.find((r) => r.value === role)?.desc}
        </p>
      </div>

      {/* Members list */}
      <div className="settings-section">
        <h2 className="settings-section-title">Miembros del equipo</h2>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Cargando...</p>
        ) : members.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Aún no has invitado a nadie.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map((member) => (
              <div key={member.id} style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            12,
                padding:        '12px 16px',
                borderRadius:   10,
                background:     'var(--surface)',
                border:         '1px solid var(--border)',
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{member.invited_email}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {ROLES.find((r) => r.value === member.role)?.label ?? member.role}
                    {' · '}
                    <span style={{ color: member.status === 'active' ? '#1a7a45' : '#b45309' }}>
                      {STATUS_LABEL[member.status] ?? member.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(member.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  title="Eliminar miembro"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
