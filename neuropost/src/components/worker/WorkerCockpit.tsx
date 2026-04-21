'use client';

import { useCallback, useEffect, useState } from 'react';
import { X }                                from 'lucide-react';
import { ClientRequestPanel }               from './ClientRequestPanel';
import { AgentBriefEditor }                 from './AgentBriefEditor';
import { CurrentResultPanel }               from './CurrentResultPanel';
import { RevisionTimeline }                 from './RevisionTimeline';
import { WorkerActionBar }                  from './WorkerActionBar';
import { WORKER_FONT as f, WORKER_FONT_CONDENSED as fc } from './theme';
import type { BriefDraft, CockpitPost, Inspiration, PostRevision } from './cockpit-types';

type Props = {
  post: CockpitPost;
  brandName?: string;
  onClose: () => void;
};

const DEFAULT_DRAFT: BriefDraft = {
  prompt:            '',
  negative_prompt:   '',
  edit_strength:     0.65,
  guidance:          7.5,
  model:             'flux-kontext-pro',
  num_outputs:       1,
  primary_image_url: '',
};

function draftFromBrief(brief: Record<string, unknown> | null | undefined): BriefDraft {
  if (!brief) return DEFAULT_DRAFT;
  return {
    prompt:            String(brief.generation_prompt ?? brief.prompt ?? ''),
    negative_prompt:   String(brief.negative_prompt ?? ''),
    edit_strength:     Number(brief.strength ?? 0.65),
    guidance:          Number(brief.guidance ?? 7.5),
    model:             (brief.model as BriefDraft['model']) ?? 'flux-kontext-pro',
    num_outputs:       Number(brief.num_outputs ?? 1),
    primary_image_url: String(brief.primary_image_url ?? ''),
  };
}

export function WorkerCockpit({ post, brandName, onClose }: Props) {
  const [revisions,        setRevisions]        = useState<PostRevision[]>([]);
  const [inspirations,     setInspirations]     = useState<Inspiration[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<PostRevision | null>(null);
  const [draft,            setDraft]            = useState<BriefDraft>(() => draftFromBrief(post.agent_brief));
  const [loadingRevisions, setLoadingRevisions] = useState(true);

  const loadRevisions = useCallback(async () => {
    try {
      const res  = await fetch(`/api/worker/posts/${post.id}/revisions`);
      if (!res.ok) return;
      const data = (await res.json()) as { revisions: PostRevision[] };
      const sorted = data.revisions ?? [];
      setRevisions(sorted);
      // Auto-select latest revision
      if (sorted.length > 0) {
        const latest = sorted[sorted.length - 1];
        setSelectedRevision(latest);
        if (latest.brief_snapshot) setDraft(draftFromBrief(latest.brief_snapshot));
      }
    } catch { /* non-blocking */ } finally {
      setLoadingRevisions(false);
    }
  }, [post.id]);

  useEffect(() => {
    void loadRevisions();

    fetch(`/api/worker/posts/${post.id}/context`)
      .then((r) => r.ok ? r.json() : { inspirations: [] })
      .then((d: { inspirations?: Inspiration[] }) => setInspirations(d.inspirations ?? []))
      .catch(() => { /* non-blocking */ });
  }, [post.id, loadRevisions]);

  function handleRevisionSelect(rev: PostRevision) {
    setSelectedRevision(rev);
    if (rev.brief_snapshot) setDraft(draftFromBrief(rev.brief_snapshot));
  }

  function handleReset() {
    setDraft(draftFromBrief(post.agent_brief));
  }

  async function handleSuccess() {
    await loadRevisions();
  }

  const colStyle: React.CSSProperties = {
    flex: '0 0 calc(33.333% - 11px)',
    minWidth: 280,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column',
      zIndex: 1200,
    }}>
      {/* Cockpit panel */}
      <div style={{
        margin: '24px auto',
        width: '96vw', maxWidth: 1400,
        height: 'calc(100vh - 48px)',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '2px solid #e5e7eb',
          background: '#f9fafb',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#0F766E',
              fontFamily: fc, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#ecfdf5', padding: '3px 8px', border: '1px solid #a7f3d0',
            }}>
              WORKER COCKPIT
            </span>
            {brandName && (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111', fontFamily: fc }}>
                {brandName}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: f }}>
              post #{post.id.slice(0, 8)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #e5e7eb',
              padding: '6px 10px', cursor: 'pointer', color: '#6b7280',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── 3 Columns ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 1,
          flex: 1,
          overflow: 'hidden',
          background: '#e5e7eb',
        }}>

          {/* Col 1 — Client request (read-only) */}
          <div style={{ ...colStyle, background: '#ffffff', padding: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: fc,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
              paddingBottom: 8, borderBottom: '1px solid #e5e7eb',
            }}>
              SOLICITUD DEL CLIENTE
            </div>
            <ClientRequestPanel post={post} inspirations={inspirations} />
          </div>

          {/* Col 2 — Agent brief editor */}
          <div style={{ ...colStyle, background: '#ffffff', padding: 20 }}>
            <AgentBriefEditor
              draft={draft}
              onChange={setDraft}
              onReset={handleReset}
            />
          </div>

          {/* Col 3 — Current result */}
          <div style={{ ...colStyle, background: '#ffffff', padding: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: fc,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
              paddingBottom: 8, borderBottom: '1px solid #e5e7eb',
            }}>
              RESULTADO ACTUAL
            </div>
            <CurrentResultPanel
              revision={selectedRevision}
              originalImageUrl={post.image_url}
            />
          </div>
        </div>

        {/* ── Timeline ───────────────────────────────────────── */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#9ca3af', fontFamily: fc,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            HISTORIAL DE REVISIONES
            {loadingRevisions && <span style={{ marginLeft: 8, fontWeight: 400 }}>cargando…</span>}
          </div>
          <RevisionTimeline
            revisions={revisions}
            selectedId={selectedRevision?.id ?? null}
            onSelect={handleRevisionSelect}
          />
        </div>

        {/* ── Action bar ─────────────────────────────────────── */}
        <div style={{
          padding: '14px 20px',
          borderTop: '2px solid #e5e7eb',
          background: '#ffffff',
          flexShrink: 0,
        }}>
          <WorkerActionBar
            postId={post.id}
            draft={draft}
            selectedRevision={selectedRevision}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}
