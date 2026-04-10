'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Copy, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#dc2626',
};

type PromoCode = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applicable_plans: string[] | null;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

type FormData = {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  applicablePlans: string[] | null;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
};

const PLANS = ['starter', 'pro', 'total', 'agencia'];

export default function CuponesTab() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'expired' | 'all'>('active');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    applicablePlans: null,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maxUses: null,
  });

  useEffect(() => {
    loadPromoCodes();
  }, [filter]);

  async function loadPromoCodes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/worker/promo-codes?filter=${filter}`);
      const data = await res.json();
      setPromoCodes(data.promoCodes ?? []);
    } catch {
      toast.error('Error al cargar cupones');
    } finally {
      setLoading(false);
    }
  }

  function openModal(code?: PromoCode) {
    if (code) {
      setEditingId(code.id);
      setForm({
        code: code.code,
        discountType: code.discount_type,
        discountValue: code.discount_value,
        applicablePlans: code.applicable_plans,
        validFrom: code.valid_from.split('T')[0],
        validUntil: code.valid_until.split('T')[0],
        maxUses: code.max_uses,
      });
    } else {
      setEditingId(null);
      setForm({
        code: '',
        discountType: 'percentage',
        discountValue: 10,
        applicablePlans: null,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        maxUses: null,
      });
    }
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!form.discountValue || form.discountValue <= 0) {
      toast.error('Ingresa un valor de descuento válido');
      return;
    }

    if (new Date(form.validFrom) >= new Date(form.validUntil)) {
      toast.error('La fecha de inicio debe ser anterior a la de fin');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/worker/promo-codes` : `/api/worker/promo-codes`;
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { id: editingId, ...form }
        : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingId ? 'Cupón actualizado' : 'Cupón creado');
        setIsModalOpen(false);
        await loadPromoCodes();
      } else {
        toast.error('Error al guardar cupón');
      }
    } catch {
      toast.error('Error al guardar cupón');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cupón?')) return;
    try {
      const res = await fetch(`/api/worker/promo-codes?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Cupón eliminado');
        await loadPromoCodes();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  }

  async function handleClone(code: PromoCode) {
    setSaving(true);
    try {
      const res = await fetch('/api/worker/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: '',
          discountType: code.discount_type,
          discountValue: code.discount_value,
          applicablePlans: code.applicable_plans,
          validFrom: code.valid_from,
          validUntil: code.valid_until,
          maxUses: code.max_uses,
        }),
      });

      if (res.ok) {
        toast.success('Cupón clonado');
        await loadPromoCodes();
      } else {
        toast.error('Error al clonar');
      }
    } catch {
      toast.error('Error al clonar');
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(code: string) {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado');
  }

  const getStatus = (code: PromoCode) => {
    if (!code.is_active) return { label: 'Inactivo', color: '#9ca3af', bg: '#f3f4f6' };
    const now = new Date();
    const expiry = new Date(code.valid_until);
    if (now > expiry) return { label: 'Vencido', color: '#dc2626', bg: '#fee2e2' };
    if (code.max_uses && code.used_count >= code.max_uses) return { label: 'Agotado', color: '#ea580c', bg: '#fed7aa' };
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 7) return { label: `Expira en ${daysLeft}d`, color: '#ea580c', bg: '#fed7aa' };
    return { label: 'Activo', color: '#0F766E', bg: '#d1fae5' };
  };

  return (
    <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>
            Gestión de Cupones
          </h2>
          <p style={{ fontFamily: f, fontSize: 13, color: C.muted, margin: 0 }}>
            Crear y gestionar códigos de descuento
          </p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: C.accent,
            color: '#fff',
            border: 'none',
            fontFamily: fc,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          <Plus size={16} /> Crear cupón
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['active', 'expired', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              background: filter === f ? C.accent : C.bg1,
              color: filter === f ? '#fff' : C.text,
              border: `1px solid ${filter === f ? C.accent : C.border}`,
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: f,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {f === 'active' ? 'Activos' : f === 'expired' ? 'Vencidos' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <p style={{ color: C.muted }}>Cargando...</p>
      ) : promoCodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: C.bg1, border: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, color: C.text, margin: 0 }}>
            Sin cupones {filter === 'all' ? '' : filter}
          </p>
          <p style={{ fontFamily: f, fontSize: 12, color: C.muted, margin: '8px 0 0 0' }}>
            Crea el primero para ofrecer descuentos
          </p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          {promoCodes.map((code, i) => {
            const status = getStatus(code);
            return (
              <div
                key={code.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 100px 80px 100px 60px',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: i < promoCodes.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                {/* Código */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <code style={{ fontWeight: 700, color: C.text }}>{code.code}</code>
                  <button
                    onClick={() => copyToClipboard(code.code)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Copiar"
                  >
                    <Copy size={12} color={C.muted} />
                  </button>
                </div>

                {/* Descuento */}
                <div>
                  <span style={{ fontWeight: 600, color: C.text }}>
                    {code.discount_type === 'percentage' ? `${code.discount_value}%` : `€${code.discount_value}`}
                  </span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>
                    {code.applicable_plans ? code.applicable_plans.join(', ') : 'Todos'}
                  </span>
                </div>

                {/* Usos */}
                <div style={{ textAlign: 'center', color: C.muted }}>
                  {code.max_uses ? `${code.used_count}/${code.max_uses}` : `${code.used_count}/∞`}
                </div>

                {/* Vencimiento */}
                <div style={{ fontSize: 11, color: C.muted }}>
                  {new Date(code.valid_until).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                </div>

                {/* Estado */}
                <div
                  style={{
                    padding: '2px 8px',
                    background: status.bg,
                    color: status.color,
                    fontWeight: 600,
                    fontSize: 10,
                    textAlign: 'center',
                    borderRadius: 0,
                  }}
                >
                  {status.label}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openModal(code)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: C.accent,
                    }}
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleClone(code)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: C.muted,
                    }}
                    title="Clonar"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(code.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: C.red,
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24, maxWidth: 500, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, color: C.text, margin: 0, textTransform: 'uppercase' }}>
                {editingId ? 'Editar cupón' : 'Nuevo cupón'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} color={C.muted} />
              </button>
            </div>

            {/* Código */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Código (dejar en blanco para generar automáticamente)
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="P.ej: SUMMER2025"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  fontFamily: f,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Tipo y valor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                  Tipo
                </label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg1,
                    border: `1px solid ${C.border}`,
                    fontFamily: f,
                    fontSize: 13,
                    color: C.text,
                    outline: 'none',
                  }}
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Cantidad fija (€)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                  Valor
                </label>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg1,
                    border: `1px solid ${C.border}`,
                    fontFamily: f,
                    fontSize: 13,
                    color: C.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Planes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Aplicable a planes (sin seleccionar = todos)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLANS.map((plan) => (
                  <button
                    key={plan}
                    onClick={() => {
                      const plans = form.applicablePlans || [];
                      setForm({
                        ...form,
                        applicablePlans: plans.includes(plan) ? plans.filter((p) => p !== plan) : [...plans, plan],
                      });
                    }}
                    style={{
                      padding: '6px 12px',
                      background: form.applicablePlans?.includes(plan) ? C.accent : C.bg1,
                      color: form.applicablePlans?.includes(plan) ? '#fff' : C.text,
                      border: `1px solid ${form.applicablePlans?.includes(plan) ? C.accent : C.border}`,
                      fontFamily: f,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      borderRadius: 0,
                    }}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                  Válido desde
                </label>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg1,
                    border: `1px solid ${C.border}`,
                    fontFamily: f,
                    fontSize: 13,
                    color: C.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                  Válido hasta
                </label>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: C.bg1,
                    border: `1px solid ${C.border}`,
                    fontFamily: f,
                    fontSize: 13,
                    color: C.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Máximo de usos */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Máximo de usos (dejar vacío para ilimitado)
              </label>
              <input
                type="number"
                value={form.maxUses || ''}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  fontFamily: f,
                  fontSize: 13,
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  fontFamily: f,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text,
                  cursor: 'pointer',
                  borderRadius: 0,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: C.accent,
                  color: '#fff',
                  border: 'none',
                  fontFamily: f,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 0,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
