// Worker auth helpers — used by worker portal API routes
import { createAdminClient, createServerClient } from '@/lib/supabase';
import type { Worker } from '@/types';

/** Get the current worker from session. Returns null if not a worker. */
export async function getWorker(): Promise<Worker | null> {
  const supabase = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data } = await db.from('workers').select('*').eq('id', user.id).eq('is_active', true).single();
  return (data as Worker | null);
}

/** Require worker access. Throws UNAUTHENTICATED or FORBIDDEN. */
export async function requireWorker(): Promise<Worker> {
  const worker = await getWorker();
  if (!worker) throw new Error('FORBIDDEN');
  return worker;
}

/** Require admin worker. */
export async function requireAdminWorker(): Promise<Worker> {
  const worker = await requireWorker();
  if (worker.role !== 'admin') throw new Error('FORBIDDEN');
  return worker;
}

/**
 * Require the current worker to be assigned to the given brand. Admins bypass
 * the assignment check. Throws FORBIDDEN otherwise.
 */
export async function requireWorkerForBrand(brandId: string): Promise<Worker> {
  const worker = await requireWorker();
  if (worker.role === 'admin') return worker;
  if (!worker.brands_assigned?.includes(brandId)) throw new Error('FORBIDDEN');
  return worker;
}

export function workerErrorResponse(err: unknown): { error: string; status: number } {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'UNAUTHENTICATED') return { error: 'No autenticado', status: 401 };
  if (message === 'FORBIDDEN') return { error: 'Acceso denegado', status: 403 };
  return { error: message, status: 500 };
}
