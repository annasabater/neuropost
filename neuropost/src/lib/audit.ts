// =============================================================================
// Audit logging — fire-and-forget audit trail for all critical actions
// =============================================================================
// Usage:
//   await logAudit({ actor_type: 'worker', action: 'approve', ... })
//   await logWorkerAction(worker.id, worker.name, 'approve', 'post', 'Approved post #482', { brand_id: '...' })
//
// IMPORTANT: audit logging NEVER throws — it catches all errors internally
// so it never breaks the main flow of the application.

import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type AuditSeverity = 'info' | 'warning' | 'critical';
type AuditActorType = 'user' | 'worker' | 'agent' | 'system' | 'stripe_webhook' | 'cron';

interface AuditLogEntry {
  actor_type: AuditActorType;
  actor_id?: string;
  actor_name?: string;
  actor_ip?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  brand_id?: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes?: Record<string, { old: any; new: any }> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | null;
  severity?: AuditSeverity;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const db: DB = createAdminClient();
    await db.from('audit_logs').insert({
      actor_type:    entry.actor_type,
      actor_id:      entry.actor_id ?? null,
      actor_name:    entry.actor_name ?? null,
      actor_ip:      entry.actor_ip ?? null,
      action:        entry.action,
      resource_type: entry.resource_type,
      resource_id:   entry.resource_id ?? null,
      resource_name: entry.resource_name ?? null,
      brand_id:      entry.brand_id ?? null,
      description:   entry.description,
      changes:       entry.changes ?? null,
      metadata:      entry.metadata ?? null,
      severity:      entry.severity ?? 'info',
    });
  } catch (err) {
    console.error('[AUDIT] Error logging:', err);
  }
}

export async function logWorkerAction(
  workerId: string, workerName: string, action: string, resourceType: string,
  description: string, opts?: Partial<AuditLogEntry>,
): Promise<void> {
  const warningActions = new Set(['delete', 'force_complete', 'change_settings', 'claim', 'reject']);
  return logAudit({
    actor_type: 'worker', actor_id: workerId, actor_name: workerName,
    action, resource_type: resourceType, description,
    severity: warningActions.has(action) ? 'warning' : 'info',
    ...opts,
  });
}

export async function logAgentAction(
  agentKey: string, action: string, resourceType: string,
  description: string, opts?: Partial<AuditLogEntry>,
): Promise<void> {
  return logAudit({
    actor_type: 'agent', actor_name: agentKey,
    action, resource_type: resourceType, description,
    ...opts,
  });
}

export async function logSystemAction(
  source: 'stripe_webhook' | 'cron' | 'system', action: string, resourceType: string,
  description: string, opts?: Partial<AuditLogEntry>,
): Promise<void> {
  return logAudit({
    actor_type: source, actor_name: source,
    action, resource_type: resourceType, description,
    ...opts,
  });
}

// ─── brand_material helpers (Sprint 12) ──────────────────────────────────────

export type BrandMaterialAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'toggle_active'
  | 'upgrade_to_v2'
  | 'conflict_resolved';

/**
 * Single entry point for every brand_material audit event. Fire-and-forget:
 * delegates to `logAudit` (which already catches internally). Never throws.
 *
 * diff_keys are field *names* only — no values — to avoid leaking sensitive
 * content into the audit trail. Exceptions:
 *   - toggle_active: metadata.new_active is safe and useful (just a boolean).
 *   - conflict_resolved: metadata carries the two dates that collided.
 */
export async function logBrandMaterialAudit(input: {
  actor_user_id:          string;
  brand_id:               string;
  material_id:            string;
  category:               'schedule' | 'promo' | 'data' | 'quote' | 'free';
  action:                 BrandMaterialAuditAction;
  schema_version_before?: number;
  schema_version_after?:  number;
  diff_keys?:             string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?:              Record<string, any>;
}): Promise<void> {
  const descriptionByAction: Record<BrandMaterialAuditAction, string> = {
    create:            `Creó material de marca (${input.category})`,
    update:            `Editó material de marca (${input.category})`,
    delete:            `Eliminó material de marca (${input.category})`,
    toggle_active:     `Cambió estado activo de material (${input.category})`,
    upgrade_to_v2:     `Actualizó material al formato v2 (${input.category})`,
    conflict_resolved: `Conflicto resuelto en material (${input.category})`,
  };

  const meta: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.schema_version_before !== undefined) meta.schema_version_before = input.schema_version_before;
  if (input.schema_version_after  !== undefined) meta.schema_version_after  = input.schema_version_after;
  if (input.diff_keys && input.diff_keys.length > 0) meta.diff_keys = input.diff_keys;

  return logAudit({
    actor_type:    'user',
    actor_id:      input.actor_user_id,
    action:        `brand_material.${input.action}`,
    resource_type: 'brand_material',
    resource_id:   input.material_id,
    brand_id:      input.brand_id,
    description:   descriptionByAction[input.action],
    metadata:      Object.keys(meta).length > 0 ? meta : null,
    severity:      input.action === 'conflict_resolved' ? 'warning'
                 : input.action === 'delete'            ? 'warning'
                 : 'info',
  });
}

/**
 * Compare two objects and return only the fields that changed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diffChanges(before: Record<string, any>, after: Record<string, any>, fieldsToTrack?: string[]): Record<string, { old: unknown; new: unknown }> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changes: Record<string, { old: any; new: any }> = {};
  const fields = fieldsToTrack ?? Object.keys({ ...before, ...after });
  for (const key of fields) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { old: before[key], new: after[key] };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
