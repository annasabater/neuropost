'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useSubscribedPlatforms } from '@/hooks/useSubscribedPlatforms';
import { PLAN_LIMITS } from '@/types';
import toast from 'react-hot-toast';

import { Section1Media }        from '@/components/posts/new/Section1Media';
import { Section2Objective }    from '@/components/posts/new/Section2Objective';
import { Section3SubType }      from '@/components/posts/new/Section3SubType';
import { Section4Description }  from '@/components/posts/new/Section4Description';
import { Section5Format }       from '@/components/posts/new/Section5Format';
import { Section6Timing }       from '@/components/posts/new/Section6Timing';
import { Section7Platforms }    from '@/components/posts/new/Section7Platforms';
import { Section8Extras }       from '@/components/posts/new/Section8Extras';
import { DeliveryModeSelector } from '@/components/posts/new/DeliveryModeSelector';
import { SubmitBar }            from '@/components/posts/new/SubmitBar';
import {
  DEFAULT_FORM_STATE,
  deriveSourceType,
  type PostFormState,
  type PostObjective,
  type DeliveryMode,
} from '@/components/posts/new/types';

const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const f  = "var(--font-barlow), 'Barlow', sans-serif";

export default function NewPostPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const brand        = useAppStore((s) => s.brand);
  const addPost      = useAppStore((s) => s.addPost);

  // Legacy ?mode=request redirect — just absorb and show unified form
  // (self-service branch archived; ?mode=auto goes to weekly planner)
  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'auto') router.replace('/planificacion');
  }, [searchParams, router]);

  const [form, setForm] = useState<PostFormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);

  const { platformsForFormat } = useSubscribedPlatforms();
  const limits      = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const canInstant  = brand?.plan !== 'starter';
  const maxPhotos   = limits.carouselMaxPhotos;
  const allowVideos = limits.videosPerWeek > 0;
  const allowStories= limits.storiesPerWeek > 0;

  // Sync platforms when format changes
  useEffect(() => {
    const available = platformsForFormat(form.outputFormat) as Array<'instagram' | 'facebook' | 'tiktok'>;
    setForm((prev) => {
      const filtered = prev.platforms.filter((p) => available.includes(p));
      return { ...prev, platforms: filtered.length > 0 ? filtered : [available[0] ?? 'instagram'] };
    });
  }, [form.outputFormat, platformsForFormat]);

  // If plan changes to starter while instant selected, downgrade
  useEffect(() => {
    if (!canInstant && form.deliveryMode === 'instant') {
      setForm((prev) => ({ ...prev, deliveryMode: 'reviewed' }));
    }
  }, [canInstant, form.deliveryMode]);

  const sourceType  = deriveSourceType(form.selectedMedia);
  const availablePlatforms = platformsForFormat(form.outputFormat) as Array<'instagram' | 'facebook' | 'tiktok'>;

  // ── Section completion ──────────────────────────────────────────────────────
  const completedSections = [
    true,                         // S1 media: always ok (optional)
    form.objective !== null,      // S2 objective
    form.subtype !== null,        // S3 subtype
    form.description.trim().length >= 10, // S4 description
    true,                         // S5 format: always has a default
    true,                         // S6 timing: optional
    form.platforms.length > 0,    // S7 platforms
    true,                         // S8 extras: optional
  ].filter(Boolean).length;

  const canSubmit = form.objective !== null && form.description.trim().length >= 10;

  // ── Field helpers ────────────────────────────────────────────────────────────
  function patch(update: Partial<PostFormState>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  function pickObjective(v: PostObjective) {
    patch({ objective: v, subtype: null, activePlaceholder: DEFAULT_FORM_STATE.activePlaceholder });
  }

  function pickSubtype(v: string, placeholder: string) {
    patch({ subtype: v, activePlaceholder: placeholder });
  }

  function pickTiming(preset: 'today' | 'tomorrow' | 'week' | 'custom', date: string) {
    patch({ timingPreset: preset, preferredDate: date });
  }

  function updatePerMedia(id: string, update: Partial<PostFormState['perMedia'][string]>) {
    setForm((prev) => ({
      ...prev,
      perMedia: { ...prev.perMedia, [id]: { ...(prev.perMedia[id] ?? { note: '', inspirationId: null }), ...update } },
    }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    if (!canSubmit) {
      toast.error('Completa el objetivo y la descripción antes de continuar');
      return;
    }

    const isVideo  = form.outputFormat === 'video' || form.outputFormat === 'reel';
    const finalQty = form.selectedMedia.length + form.extraGenerated;

    if (!isVideo && finalQty === 0) {
      toast.error('Añade al menos una foto o indica cuántas quieres que genere la IA');
      return;
    }

    setSubmitting(true);
    try {
      const urgency = form.timingPreset === 'today' ? 'urgente' : 'flexible';

      const perImageMeta = form.selectedMedia.map((m) => ({
        media_id:       m.id,
        media_url:      m.url,
        note:           form.perMedia[m.id]?.note?.trim() || null,
        inspiration_id: form.perMedia[m.id]?.inspirationId ?? null,
      }));

      const meta = {
        post_objective:        form.objective,
        request_kind:          form.subtype,
        global_description:    form.description.trim(),
        source_type:           sourceType,
        output_format:         form.outputFormat,
        video_duration:        isVideo ? form.videoDuration : null,
        user_provided_count:   form.selectedMedia.length,
        extra_to_generate:     form.extraGenerated,
        total_quantity:        finalQty,
        urgency,
        timing_preset:         form.timingPreset,
        preferred_date:        form.preferredDate || null,
        extra_notes:           form.extraNotes || null,
        proposed_caption:      form.proposedCaption.trim() || null,
        global_inspiration_ids:form.globalInspirationIds.length > 0 ? form.globalInspirationIds : null,
        per_image:             perImageMeta,
      };

      let firstPostId: string | null = null;
      let created = 0;

      if (isVideo) {
        const sourceFiles = form.selectedMedia.map((m) => m.url);
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption:       form.description.trim(),
            image_url:     form.selectedMedia[0]?.url ?? null,
            status:        'request',
            source_type:   sourceType,
            format:        form.outputFormat,
            video_duration:form.videoDuration,
            delivery_mode: form.deliveryMode,
            platform:      form.platforms.length > 0 ? form.platforms : ['instagram'],
            scheduled_at:  form.preferredDate ? new Date(form.preferredDate).toISOString() : null,
            ai_explanation:JSON.stringify({ ...meta, source_files: sourceFiles }),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
        addPost(json.post);
        firstPostId = json.post.id;
        created++;
      } else {
        const qty = Math.max(1, finalQty);
        for (let i = 0; i < qty; i++) {
          const isUserProvided = i < form.selectedMedia.length;
          const media    = isUserProvided ? form.selectedMedia[i] : null;
          const perNote  = media ? form.perMedia[media.id]?.note?.trim() : null;
          const caption  = qty > 1
            ? `${form.description.trim()} (${i + 1}/${qty})${perNote ? ` — ${perNote}` : ''}`
            : `${form.description.trim()}${perNote ? ` — ${perNote}` : ''}`;

          const res = await fetch('/api/posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caption,
              image_url:     media?.url ?? null,
              status:        'request',
              source_type:   sourceType,
              format:        form.outputFormat,
              delivery_mode: form.deliveryMode,
              platform:      form.platforms.length > 0 ? form.platforms : ['instagram'],
              scheduled_at:  form.preferredDate ? new Date(form.preferredDate).toISOString() : null,
              ai_explanation:JSON.stringify(meta),
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
          addPost(json.post);
          if (!firstPostId) firstPostId = json.post.id;
          created++;
        }
      }

      if (created === 0) { toast.error('Error al enviar'); return; }

      if (form.deliveryMode === 'instant' && firstPostId) {
        router.push(`/posts/new/generating?id=${firstPostId}&count=${created}`);
      } else {
        router.push(`/posts/new/confirmation?count=${created}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 760, paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '48px 0 32px' }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900,
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          textTransform: 'uppercase', letterSpacing: '0.01em',
          color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10,
        }}>
          Nuevo contenido
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontFamily: f }}>
          Completa las secciones para crear tu solicitud.
        </p>
      </div>

      <Section1Media
        selected={form.selectedMedia}
        perMedia={form.perMedia}
        onChange={(items) => patch({ selectedMedia: items })}
        onPerMedia={updatePerMedia}
        maxPhotos={maxPhotos}
      />

      <Section2Objective
        value={form.objective}
        onChange={pickObjective}
      />

      <Section3SubType
        objective={form.objective}
        value={form.subtype}
        onChange={pickSubtype}
      />

      <Section4Description
        value={form.description}
        placeholder={form.activePlaceholder}
        onChange={(v) => patch({ description: v })}
      />

      <Section5Format
        sourceType={sourceType}
        mediaCount={form.selectedMedia.length}
        value={form.outputFormat}
        videoDuration={form.videoDuration}
        extraGenerated={form.extraGenerated}
        maxPhotos={maxPhotos}
        allowVideos={allowVideos}
        allowStories={allowStories}
        onChange={(fmt) => patch({ outputFormat: fmt })}
        onDuration={(d) => patch({ videoDuration: d })}
        onExtra={(n) => patch({ extraGenerated: n })}
      />

      <Section6Timing
        value={form.timingPreset}
        preferredDate={form.preferredDate}
        onChange={pickTiming}
      />

      <Section7Platforms
        available={availablePlatforms}
        value={form.platforms}
        format={form.outputFormat}
        onChange={(platforms) => patch({ platforms })}
      />

      <Section8Extras
        extraNotes={form.extraNotes}
        proposedCaption={form.proposedCaption}
        onNotes={(v) => patch({ extraNotes: v })}
        onCaption={(v) => patch({ proposedCaption: v })}
      />

      <DeliveryModeSelector
        value={form.deliveryMode}
        canInstant={canInstant}
        onChange={(v: DeliveryMode) => patch({ deliveryMode: v })}
      />

      <SubmitBar
        deliveryMode={form.deliveryMode}
        submitting={submitting}
        canSubmit={canSubmit}
        completedSections={completedSections}
        totalSections={8}
        onSubmit={submit}
      />
    </div>
  );
}
