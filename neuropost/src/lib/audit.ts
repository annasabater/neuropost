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
