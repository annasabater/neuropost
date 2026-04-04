'use client';

import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Lightbulb, Send, Zap } from 'lucide-react';
import type { IdeaItem, SocialSector } from '@/types';
import { useAppStore } from '@/store/useAppStore';

// Preset campaign prompts per sector
const CAMPAIGN_PRESETS: { label: string; prompt: string; emoji: string }[] = [
  { label: 'Campaña verano',      emoji: '☀️', prompt: 'Campaña de verano: contenido fresco y veraniego para aumentar ventas en la temporada estival' },
  { label: 'San Valentín',        emoji: '❤️', prompt: 'Campaña San Valentín: ideas románticas y ofertas especiales para parejas' },
  { label: 'Vuelta al cole',      emoji: '📚', prompt: 'Campaña vuelta al cole: contenido enfocado en familia y preparación para septiembre' },
  { label: 'Black Friday',        emoji: '🛍️', prompt: 'Campaña Black Friday: ofertas especiales, descuentos y urgencia de compra' },
  { label: 'Navidad',             emoji: '🎄', prompt: 'Campaña Navidad: contenido festivo, felicitaciones y regalos especiales' },
  { label: 'Año nuevo',           emoji: '🥂', prompt: 'Campaña Año Nuevo: propósitos, nuevos comienzos y celebración de logros' },
  { label: 'Fidelización',        emoji: '🤝', prompt: 'Contenido de fidelización: agradecimiento a clientes, historias de éxito y testimonios' },
  { label: 'Lanzamiento producto', emoji: '🚀', prompt: 'Lanzamiento de nuevo producto o servicio: generar expectación y conversión' },
];

const SECTOR_PROMPTS: Partial<Record<SocialSector, string[]>> = {
  heladeria:    ['Ideas para el verano con helados', 'Nuevos sabores de temporada', 'Combinaciones especiales para parejas'],
  restaurante:  ['Menú del día especial', 'Platos estrella para Instagram', 'Evento gastronómico del mes'],
  cafeteria:    ['Nuevas bebidas de temporada', 'Rituales de café matutino', 'Brunch especial de fin de semana'],
  gym:          ['Reto fitness del mes', 'Transformaciones de clientes', 'Nueva clase o actividad'],
  clinica:      ['Consejo de salud semanal', 'Tratamiento estrella del mes', 'FAQ sobre bienestar'],
  barberia:     ['Tendencia de corte del mes', 'Antes y después de clientes', 'Servicio especial de temporada'],
  boutique:     ['Nueva colección de temporada', 'Look del día', 'Outfit para evento especial'],
  inmobiliaria: ['Propiedad destacada de la semana', 'Consejos para compradores', 'El mercado inmobiliario hoy'],
};

export default function IdeasPage() {
  const brand = useAppStore((s) => s.brand);
  const [ideas,   setIdeas]   = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [count,   setCount]   = useState(6);
  const promptRef = useRef<HTMLInputElement>(null);

  const generate = useCallback(async (overridePrompt?: string) => {
    const prompt = overridePrompt ?? promptRef.current?.value.trim();
    if (!prompt) { toast.error('Escribe un prompt para generar ideas'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/agents/ideas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al generar ideas');
      setIdeas(json.data.ideas);
      toast.success(`${json.data.ideas.length} propuestas preparadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, [count]);

  function usePreset(prompt: string) {
    if (promptRef.current) promptRef.current.value = prompt;
    generate(prompt);
  }

  function copyCaption(caption: string) {
    navigator.clipboard.writeText(caption);
    toast.success('Caption copiado');
  }

  const GOAL_EMOJI: Record<string, string> = { engagement: '💬', awareness: '👁', promotion: '🛒', community: '🤝' };
  const sectorHints = brand?.sector ? SECTOR_PROMPTS[brand.sector] ?? [] : [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Generador de ideas</h1>
          <p className="page-sub">Describe qué quieres publicar y te prepararemos ideas completas</p>
        </div>
      </div>

      {/* Prompt area */}
      <div className="ideas-prompt-area">
        <div className="ideas-prompt-row">
          <input
            ref={promptRef}
            className="ideas-prompt-input"
            placeholder="Ej: Ideas para el verano, promos de agosto, recetas especiales..."
            onKeyDown={(e) => e.key === 'Enter' && generate()}
          />
          <select
            className="count-select"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[3, 6, 9, 12, 20].map((n) => <option key={n} value={n}>{n} ideas</option>)}
          </select>
          <button className="btn-primary btn-orange" onClick={() => generate()} disabled={loading}>
            {loading ? <span className="loading-spinner" /> : <Send size={16} />}
            {loading ? 'Generando...' : 'Generar'}
          </button>
        </div>
      </div>

      {/* Sector-specific quick prompts */}
      {sectorHints.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Ideas para tu sector
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sectorHints.map((hint) => (
              <button
                key={hint}
                onClick={() => usePreset(hint)}
                disabled={loading}
                style={{
                  padding:      '6px 14px',
                  borderRadius: 20,
                  border:       '1px solid var(--border)',
                  background:   'var(--surface)',
                  fontSize:     '0.8rem',
                  fontFamily:   "'Cabinet Grotesk', sans-serif",
                  fontWeight:   600,
                  cursor:       'pointer',
                  color:        'var(--ink)',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                }}
              >
                <Lightbulb size={13} color="var(--orange)" /> {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Campaign presets */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Campañas predefinidas
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CAMPAIGN_PRESETS.map((cp) => (
            <button
              key={cp.label}
              onClick={() => usePreset(cp.prompt)}
              disabled={loading}
              style={{
                padding:      '7px 14px',
                borderRadius: 20,
                border:       '1px solid var(--border)',
                background:   'white',
                fontSize:     '0.8rem',
                fontFamily:   "'Cabinet Grotesk', sans-serif",
                fontWeight:   600,
                cursor:       'pointer',
                color:        'var(--ink)',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
              }}
            >
              <span>{cp.emoji}</span> {cp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ideas grid */}
      {ideas.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="section-title" style={{ margin: 0 }}>{ideas.length} propuestas preparadas</h2>
            <button className="btn-outline" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => generate()}>
              <Zap size={13} /> Regenerar
            </button>
          </div>
          <div className="ideas-grid">
            {ideas.map((idea, i) => (
              <div key={i} className="idea-card">
                <div className="idea-card-header">
                  <h3 className="idea-title">{idea.title}</h3>
                  <span className="idea-format-badge">{idea.format}</span>
                </div>
                <p className="idea-caption">{idea.caption}</p>
                {idea.hashtags.length > 0 && (
                  <p className="idea-hashtags">
                    {idea.hashtags.slice(0, 5).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                  </p>
                )}
                {idea.rationale && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4, marginBottom: 10, fontStyle: 'italic' }}>
                    {idea.rationale}
                  </p>
                )}
                <div className="idea-footer">
                  <span className="idea-meta">
                    {GOAL_EMOJI[idea.goal] ?? '✨'} {idea.bestTime || 'Cualquier hora'}
                  </span>
                  <button className="copy-btn" onClick={() => copyCaption(idea.caption)}>
                    Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {ideas.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon"><Lightbulb size={36} color="var(--orange)" /></div>
          <p className="empty-state-title">Listo para inspirarte</p>
          <p className="empty-state-sub">Escribe una idea, usa una campaña predefinida o elige una sugerencia de tu sector</p>
        </div>
      )}
    </div>
  );
}