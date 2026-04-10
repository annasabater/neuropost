'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Plus, Save, X, Trash2, Bot, Play, Pause, RefreshCw, Edit2, Users, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import EquipoTab from './components/EquipoTab';
import CuponesTab from './components/CuponesTab';
import { createBrowserClient } from '@/lib/supabase';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#0F766E',
  orange: '#0D9488',
  green: '#0F766E',
};

interface AgentConfig {
  id: string;
  agent: string;
  is_active: boolean;
  system_prompt: string | null;
  model: string;
  cron_schedule: string;
  max_daily_cost_usd: number;
  max_monthly_cost_usd: number;
  max_retries: number;
  timeout_seconds: number;
  concurrency_limit: number;
}

interface AgentLog {
  id: string;
  agent_name: string;
  status: string;
  details: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: AGENTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AgentesTab() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [logs, setLogs] = useState<Record<string, AgentLog[]>>({});
  const [stats, setStats] = useState<Record<string, { runs: number; errors: number; lastRun: string | null }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfgs } = await (sb as any).from('agent_configs').select('*').order('agent');
    setConfigs(cfgs ?? []);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logsData } = await (sb as any)
      .from('agent_logs')
      .select('*')
      .gte('created_at', dayAgo)
      .order('created_at', { ascending: false });

    const grouped: Record<string, AgentLog[]> = {};
    const statsCalc: Record<string, { runs: number; errors: number; lastRun: string | null }> = {};
    (logsData ?? []).forEach((l: AgentLog) => {
      const key = l.agent_name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(l);
      if (!statsCalc[key]) statsCalc[key] = { runs: 0, errors: 0, lastRun: null };
      statsCalc[key].runs++;
      if (l.status === 'error') statsCalc[key].errors++;
      if (!statsCalc[key].lastRun) statsCalc[key].lastRun = l.created_at;
    });
    setLogs(grouped);
    setStats(statsCalc);
    setLoading(false);
  }

  async function toggleActive(cfg: AgentConfig) {
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('agent_configs').update({ is_active: !cfg.is_active }).eq('id', cfg.id);
    setConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, is_active: !c.is_active } : c));
    toast.success(cfg.is_active ? `${cfg.agent} pausado` : `${cfg.agent} activado`);
  }

  async function savePrompt(cfg: AgentConfig) {
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('agent_configs').update({ system_prompt: promptDraft }).eq('id', cfg.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('agent_prompt_versions').insert({
      agent: cfg.agent,
      version: Date.now(),
      system_prompt: promptDraft,
      change_reason: 'Editado desde settings',
    });
    setConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, system_prompt: promptDraft } : c));
    setEditing(null);
    toast.success('Prompt actualizado');
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando agentes...</div>;

  return (
    <div style={{ padding: 28, color: C.text, flex: 1, overflow: 'auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Bot size={22} style={{ color: C.accent2 }} /> Monitor de agentes
      </h1>
      <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 24px' }}>
        Estado, configuración y logs de los agentes IA
      </p>

      <div style={{ display: 'grid', gap: 16 }}>
        {configs.map((cfg) => {
          const s = stats[cfg.agent] ?? { runs: 0, errors: 0, lastRun: null };
          const errorRate = s.runs > 0 ? ((s.errors / s.runs) * 100).toFixed(1) : '0.0';
          return (
            <div key={cfg.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0 }}>
              <div style={{ padding: 20, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: cfg.is_active ? '#10b981' : C.muted,
                    }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>
                      {cfg.agent.replace(/_/g, ' ')}
                    </h3>
                    <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{cfg.cron_schedule}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleActive(cfg)} style={iconBtn}>
                      {cfg.is_active ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button onClick={load} style={iconBtn}>
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => { setEditing(cfg.agent); setPromptDraft(cfg.system_prompt ?? ''); }} style={iconBtn}>
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                  <Metric label="Modelo" value={cfg.model.replace('claude-', '').slice(0, 10)} />
                  <Metric label="Runs (24h)" value={String(s.runs)} />
                  <Metric label="Errores" value={`${s.errors} (${errorRate}%)`} highlight={s.errors > 0 ? '#ef4444' : undefined} />
                  <Metric label="Último run" value={s.lastRun ? timeAgo(s.lastRun) : '—'} />
                  <Metric label="Concurrencia" value={String(cfg.concurrency_limit)} />
                </div>
              </div>

              {/* Recent logs */}
              <div style={{ padding: 16, background: C.bg1 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Últimos 5 runs
                </div>
                {(logs[cfg.agent] ?? []).slice(0, 5).map((l) => (
                  <div key={l.id} style={{ display: 'flex', gap: 12, padding: '4px 0', fontSize: 11, alignItems: 'center' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.status === 'error' ? '#ef4444' : l.status === 'success' ? '#10b981' : C.muted }} />
                    <span style={{ color: C.muted, width: 60 }}>{timeAgo(l.created_at)}</span>
                    <span style={{ color: C.muted, width: 70 }}>{l.duration_ms ?? '—'}ms</span>
                    <span style={{ flex: 1, color: l.status === 'error' ? '#ef4444' : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(l.details).slice(0, 100)}
                    </span>
                  </div>
                ))}
                {(logs[cfg.agent] ?? []).length === 0 && (
                  <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Sin actividad reciente</p>
                )}
              </div>

              {/* Prompt editor */}
              {editing === cfg.agent && (
                <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>System Prompt</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => savePrompt(cfg)} style={{ ...iconBtn, color: '#10b981' }}>
                        <Save size={13} />
                      </button>
                      <button onClick={() => setEditing(null)} style={iconBtn}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    rows={12}
                    style={{
                      width: '100%', padding: 12, background: C.bg1, color: C.text,
                      border: `1px solid ${C.border}`, borderRadius: 0, fontSize: 11,
                      fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 3: FACTURACIÓN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FacturacionTab() {
  return <CuponesTab />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 4: GENERAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
}

function GeneralTab() {
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
    <div style={{ padding: 28, color: C.text, flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <SettingsIcon size={22} style={{ color: C.accent2 }} /> Configuración general
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>Configuración global del portal</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {[
          { k: 'agents', l: 'Límites de agentes' },
          { k: 'canned', l: 'Respuestas predefinidas' },
          { k: 'logs', l: 'Logs y auditoría' },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as 'agents' | 'canned' | 'logs')} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            color: tab === t.k ? C.accent2 : C.muted,
            borderBottom: `2px solid ${tab === t.k ? C.accent2 : 'transparent'}`,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {/* Agents tab */}
      {tab === 'agents' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg1 }}>
                <th style={th}>Agente</th>
                <th style={th}>Frecuencia (cron)</th>
                <th style={th}>Coste diario máx ($)</th>
                <th style={th}>Coste mensual máx ($)</th>
              </tr>
            </thead>
            <tbody>
              {agentConfigs.map((cfg) => (
                <tr key={cfg.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td, textTransform: 'capitalize', fontWeight: 600 }}>{cfg.agent.replace(/_/g, ' ')}</td>
                  <td style={td}><code style={{ fontSize: 11, color: C.muted }}>{cfg.cron_schedule}</code></td>
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
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 16, marginBottom: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Nueva respuesta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 8 }}>
              <input placeholder="Título" value={newCanned.title} onChange={(e) => setNewCanned({ ...newCanned, title: e.target.value })} style={inputStyle} />
              <select value={newCanned.category} onChange={(e) => setNewCanned({ ...newCanned, category: e.target.value })} style={inputStyle}>
                <option value="general">General</option>
                <option value="greeting">Saludo</option>
                <option value="billing">Facturación</option>
                <option value="technical">Técnico</option>
                <option value="content">Contenido</option>
              </select>
              <button onClick={addCanned} style={{ ...inputStyle, background: C.accent2, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <Plus size={13} style={{ marginRight: 4 }} /> Añadir
              </button>
            </div>
            <textarea placeholder="Contenido" value={newCanned.content} onChange={(e) => setNewCanned({ ...newCanned, content: e.target.value })} rows={3} style={{ ...inputStyle, marginTop: 8, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
            {canned.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No hay respuestas predefinidas</div>
            ) : (
              canned.map((c) => (
                <div key={c.id} style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
                      <span style={{ fontSize: 9, padding: '2px 6px', background: C.bg1, color: C.muted, borderRadius: 0, textTransform: 'uppercase' }}>{c.category}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                  <button onClick={() => deleteCanned(c.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 4 }}>
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
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Visita <Link href="/worker/agents" style={{ color: C.accent2 }}>Monitor de agentes</Link> para ver logs detallados.
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5,
};
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', background: C.bg1, border: `1px solid ${C.border}`,
  color: C.text, borderRadius: 0, fontSize: 12, fontFamily: 'inherit',
};
const iconBtn: React.CSSProperties = {
  width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`,
  borderRadius: 0, color: C.text, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <p style={{ fontSize: 13, fontWeight: 600, margin: '2px 0 0', color: highlight ?? C.text }}>{value}</p>
    </div>
  );
}

function timeAgo(date: string): string {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SettingsTab = 'equipo' | 'agentes' | 'facturacion' | 'general';
type IconProps = { size?: number; style?: React.CSSProperties };

const SETTINGS_TABS: { key: SettingsTab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'equipo', title: 'Equipo', desc: 'Gestión', icon: Users },
  { key: 'agentes', title: 'Agentes', desc: 'Automatización', icon: Bot },
  { key: 'facturacion', title: 'Facturación', desc: 'Facturación', icon: CreditCard },
  { key: 'general', title: 'General', desc: 'Config', icon: SettingsIcon },
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as SettingsTab) || 'equipo';

  function setTab(t: SettingsTab) {
    router.push(`/worker/settings?tab=${t}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '48px 40px 40px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: C.text, lineHeight: 0.95, marginBottom: 8 }}>
          Configuración
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>Ajustes del sistema</p>
      </div>

      {/* Tab selector — Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
        {SETTINGS_TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '28px 20px',
                background: active ? C.accent : C.card,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={28} style={{ color: active ? '#ffffff' : C.accent2 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#ffffff' : C.text }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : C.muted, marginTop: 4 }}>
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'equipo' && <EquipoTab />}
        {tab === 'agentes' && <AgentesTab />}
        {tab === 'facturacion' && <FacturacionTab />}
        {tab === 'general' && <GeneralTab />}
      </div>
    </div>
  );
}
