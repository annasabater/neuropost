'use client';

import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
}

export default function WorkerSettingsPage() {
  const [tab, setTab] = useState<'agents' | 'canned' | 'logs'>('agents');
  const [canned, setCanned] = useState<CannedResponse[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<{ id: string; agent: string; max_daily_cost_usd: number; max_monthly_cost_usd: number; cron_schedule: string }[]>([]);
  const [newCanned, setNewCanned] = useState({ title: '', content: '', category: 'general' });

  useEffect(() => {
    (async () => {
      const sb = createBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: c } = await (sb as any).from('canned_responses').select('*').order('title');
      setCanned(c ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: a } = await (sb as any).from('agent_configs').select('*').order('agent');
      setAgentConfigs(a ?? []);
    })();
  }, []);

  async function saveAgentLimit(id: string, field: string, value: number) {
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('agent_configs').update({ [field]: value }).eq('id', id);
    toast.success('Guardado');
  }

  async function addCanned() {
    if (!newCanned.title || !newCanned.content) return;
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any).from('canned_responses').insert(newCanned).select().single();
    if (data) setCanned((prev) => [...prev, data]);
    setNewCanned({ title: '', content: '', category: 'general' });
    toast.success('Respuesta añadida');
  }

  async function deleteCanned(id: string) {
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('canned_responses').delete().eq('id', id);
    setCanned((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div style={{ padding: 28, color: W.text }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <SettingsIcon size={22} style={{ color: W.blue }} /> Configuración
        </h1>
        <p style={{ color: W.muted, fontSize: 13, margin: '4px 0 0' }}>Configuración global del portal</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${W.border}` }}>
        {[
          { k: 'agents', l: 'Límites de agentes' },
          { k: 'canned', l: 'Respuestas predefinidas' },
          { k: 'logs', l: 'Logs y auditoría' },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as 'agents' | 'canned' | 'logs')} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            color: tab === t.k ? W.blue : W.muted,
            borderBottom: `2px solid ${tab === t.k ? W.blue : 'transparent'}`,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {/* Agents tab */}
      {tab === 'agents' && (
        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: W.bg }}>
                <th style={th}>Agente</th>
                <th style={th}>Frecuencia (cron)</th>
                <th style={th}>Coste diario máx ($)</th>
                <th style={th}>Coste mensual máx ($)</th>
              </tr>
            </thead>
            <tbody>
              {agentConfigs.map((cfg) => (
                <tr key={cfg.id} style={{ borderTop: `1px solid ${W.border}` }}>
                  <td style={{ ...td, textTransform: 'capitalize', fontWeight: 600 }}>{cfg.agent.replace(/_/g, ' ')}</td>
                  <td style={td}><code style={{ fontSize: 11, color: W.muted }}>{cfg.cron_schedule}</code></td>
                  <td style={td}>
                    <input type="number" defaultValue={cfg.max_daily_cost_usd} onBlur={(e) => saveAgentLimit(cfg.id, 'max_daily_cost_usd', parseFloat(e.target.value))} style={inputStyle} />
                  </td>
                  <td style={td}>
                    <input type="number" defaultValue={cfg.max_monthly_cost_usd} onBlur={(e) => saveAgentLimit(cfg.id, 'max_monthly_cost_usd', parseFloat(e.target.value))} style={inputStyle} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Canned responses tab */}
      {tab === 'canned' && (
        <div>
          <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Nueva respuesta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 8 }}>
              <input placeholder="Título" value={newCanned.title} onChange={(e) => setNewCanned({ ...newCanned, title: e.target.value })} style={inputStyle} />
              <select value={newCanned.category} onChange={(e) => setNewCanned({ ...newCanned, category: e.target.value })} style={inputStyle}>
                <option value="general">General</option>
                <option value="greeting">Saludo</option>
                <option value="billing">Facturación</option>
                <option value="technical">Técnico</option>
                <option value="content">Contenido</option>
                <option value="onboarding">Onboarding</option>
                <option value="closing">Cierre</option>
              </select>
              <button onClick={addCanned} style={{ ...inputStyle, background: W.blue, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <Plus size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Añadir
              </button>
            </div>
            <textarea placeholder="Contenido de la respuesta. Usa {nombre_usuario} para variables." value={newCanned.content} onChange={(e) => setNewCanned({ ...newCanned, content: e.target.value })} rows={3} style={{ ...inputStyle, marginTop: 8, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {canned.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: W.muted, fontSize: 13 }}>No hay respuestas predefinidas</div>
            ) : (
              canned.map((c) => (
                <div key={c.id} style={{ padding: 14, borderBottom: `1px solid ${W.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
                      <span style={{ fontSize: 9, padding: '2px 6px', background: W.bg, color: W.muted, borderRadius: 3, textTransform: 'uppercase' }}>{c.category}</span>
                    </div>
                    <p style={{ fontSize: 12, color: W.muted, margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                  <button onClick={() => deleteCanned(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 8, padding: 24, textAlign: 'center', color: W.muted, fontSize: 13 }}>
          Visita <a href="/worker/agents" style={{ color: W.blue }}>Monitor de agentes</a> para ver logs detallados de cada agente.
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, color: W.muted, textTransform: 'uppercase', letterSpacing: 0.5,
};
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: W.bg, border: `1px solid ${W.border}`,
  color: W.text, borderRadius: 4, fontSize: 12, fontFamily: 'inherit',
};
