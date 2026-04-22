// =============================================================================
// Intent system
// =============================================================================
// Maps human-friendly intent names to deterministic execution plans.
// The orchestrator receives an `intent` (e.g. "create_reel") instead of
// raw (agent_type, action) pairs, and this module resolves it into an
// ordered list of jobs to queue.
//
// Why intents:
//   • Frontend never knows about agent internals
//   • One intent can expand to multiple jobs (pipeline)
//   • Adding a new step to a workflow = editing this map, not touching UI
//   • Plan gating happens per-action inside the orchestrator, not here
//
// Intent resolution is DETERMINISTIC — no LLM, no branching. The orchestrator
// calls resolveIntent() and queues whatever comes back.

import type { AgentType } from './types';

export interface IntentStep {
  agent_type: AgentType;
  action:     string;
  /** Merged with the caller's input. Handler-specific fields go here. */
  extra_input?: Record<string, unknown>;
  /** Priority override. Default = 60. */
  priority?:   number;
}

export interface IntentDefinition {
  /** Ordered steps. Each step becomes a job. If step N depends on step N-1,
   *  the orchestrator chains them via parent_job_id. */
  steps:       IntentStep[];
  /** If true, all steps run as sub-jobs of a single parent "intent" job.
   *  This groups them in the UI and enables "cancel intent = cancel all". */
  grouped:     boolean;
  /** Short label shown in UI / logs. */
  label:       string;
}

// =============================================================================
// Intent catalog
// =============================================================================

const INTENTS: Record<string, IntentDefinition> = {

  // ── Content creation ───────────────────────────────────────────────────

  create_post: {
    label: 'Crear post con imagen',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'generate_caption', priority: 70 },
      { agent_type: 'content', action: 'generate_image',   priority: 70 },
    ],
  },

  create_reel: {
    label: 'Crear reel',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'generate_caption', priority: 70 },
      { agent_type: 'content', action: 'generate_video',   priority: 70 },
    ],
  },

  create_carousel: {
    label: 'Crear carrusel',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'generate_caption', priority: 70, extra_input: { format: 'carousel' } },
      { agent_type: 'content', action: 'generate_image',   priority: 70, extra_input: { format: 'post' } },
    ],
  },

  create_story: {
    label: 'Crear story',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'generate_caption', priority: 70, extra_input: { format: 'story' } },
      { agent_type: 'content', action: 'generate_image',   priority: 70, extra_input: { format: 'story' } },
    ],
  },

  edit_image: {
    label: 'Editar imagen existente',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'plan_edit',   priority: 65 },
      { agent_type: 'content', action: 'apply_edit',  priority: 65 },
    ],
  },

  // ── Strategy ───────────────────────────────────────────────────────────

  plan_week: {
    label: 'Planificar semana de contenido',
    grouped: true,
    steps: [
      { agent_type: 'strategy', action: 'build_taxonomy', priority: 80, extra_input: {} },
      { agent_type: 'strategy', action: 'plan_week',      priority: 75 },
    ],
  },

  generate_ideas: {
    label: 'Generar ideas de contenido',
    grouped: false,
    steps: [
      { agent_type: 'strategy', action: 'generate_ideas', priority: 60 },
    ],
  },

  // ── Analytics ──────────────────────────────────────────────────────────

  analyze_performance: {
    label: 'Análisis de rendimiento',
    grouped: true,
    steps: [
      { agent_type: 'analytics', action: 'sync_post_metrics',   priority: 50 },
      { agent_type: 'analytics', action: 'analyze_performance', priority: 50 },
    ],
  },

  analyze_competitor: {
    label: 'Análisis de competencia',
    grouped: false,
    steps: [
      { agent_type: 'analytics', action: 'analyze_competitor', priority: 50 },
    ],
  },

  // ── Support ────────────────────────────────────────────────────────────

  handle_message: {
    label: 'Gestionar mensaje de cliente',
    grouped: false,
    steps: [
      { agent_type: 'support', action: 'handle_interactions', priority: 80 },
    ],
  },

  // ── Publishing ─────────────────────────────────────────────────────────

  publish_post: {
    label: 'Publicar post con moderación',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'safe_publish', priority: 90 },
    ],
  },

  schedule_posts: {
    label: 'Programar posts de la semana',
    grouped: false,
    steps: [
      { agent_type: 'scheduling', action: 'auto_schedule_week', priority: 60 },
    ],
  },

  // ── Advanced / growth ──────────────────────────────────────────────────

  ab_test: {
    label: 'A/B test de captions',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'ab_test_captions', priority: 60 },
    ],
  },

  repurpose: {
    label: 'Reaprovechar post top',
    grouped: true,
    steps: [
      { agent_type: 'content', action: 'repurpose_top_post', priority: 55 },
    ],
  },

  predict: {
    label: 'Predecir rendimiento',
    grouped: false,
    steps: [
      { agent_type: 'analytics', action: 'predict_engagement', priority: 50 },
    ],
  },

  tag_media: {
    label: 'Etiquetar imagen subida',
    grouped: false,
    steps: [
      { agent_type: 'content', action: 'tag_media', priority: 40 },
    ],
  },

  // ── Moderation ─────────────────────────────────────────────────────────

  moderate_comment: {
    label: 'Moderar comentario de Instagram',
    grouped: false,
    steps: [
      { agent_type: 'moderation', action: 'check_brand_safety', priority: 85 },
    ],
  },
};

// =============================================================================
// Public API
// =============================================================================

export function resolveIntent(intentName: string): IntentDefinition | null {
  return INTENTS[intentName] ?? null;
}

export function listIntents(): Array<{ name: string; label: string }> {
  return Object.entries(INTENTS).map(([name, def]) => ({ name, label: def.label }));
}
