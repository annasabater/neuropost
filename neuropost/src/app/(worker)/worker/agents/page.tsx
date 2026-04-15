'use client';

import { useEffect, useState } from 'react';
import { Bot, Play, Pause, RefreshCw, Edit2, Save, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
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

export default function AgentsMonitorPage() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [logs, setLogs] = useState<Record<string, AgentLog[]>>({});
  const [stats, setStats] = useState<Record<string, { runs: number; errors: number; lastRun: string | null }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfgs } = await (sb as any).from('agent_configs').select('*').order('agent');
    setConfigs(cfgs ?? []);

    // Get last 24h of logs
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
    // Save version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('agent_prompt_versions').insert({
      agent: cfg.agent,
      version: Date.now(),
      system_prompt: promptDraft,
      change_reason: 'Editado desde panel',
    });
    setConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, system_prompt: promptDraft } : c));
    setEditing(null);
    toast.success('Prompt actualizado');
  }

  async function triggerQueue() {
    setTriggering(true);
    try {
      const res = await fetch('/api/worker/trigger-queue', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Cola ejecutada: ${data.processed ?? 0} jobs procesados`);
        load();
      } else {
        toast.error(data.error ?? 'Error al ejecutar la cola');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando agentes...</div>;

  return (
    <div style={{ padding: 28, color: C.text }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={22} style={{ color: C.accent2 }} /> Monitor de agentes
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Estado, configuración y logs de los agentes IA
          </p>
        </div>
        <button
          type="button"
          onClick={triggerQueue}
          disabled={triggering}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', background: C.accent, color: '#fff',
            border: 'none', borderRadius: 0, fontWeight: 700, fontSize: 13,
            cursor: triggering ? 'not-allowed' : 'pointer',
            opacity: triggering ? 0.6 : 1,
          }}
        >
          <Zap size={14} />
          {triggering ? 'Ejecutando...' : 'Ejecutar cola ahora'}
        </button>
      </div>

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
                  <Metric label="Modelo" value={cfg.model.replace('claude-', '').replace('-20250514', '').replace('-20251001', '')} />
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

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <span style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <p style={{ fontSize: 13, fontWeight: 600, margin: '2px 0 0', color: highlight ?? C.text }}>{value}</p>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, background: 'transparent', border: `1px solid ${C.border}`,
  borderRadius: 0, color: C.text, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function timeAgo(date: string): string {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
