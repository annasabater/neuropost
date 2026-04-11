/**
 * Client-side testimonials store (localStorage-backed).
 *
 * Users submit "comentarios sobre la web" from /inbox?tab=comentarios.
 * Submissions land in `pending` and become visible only after a worker
 * approves them from /worker/inbox?tab=testimonios.
 *
 * This is intentionally a mock / local-only store — no backend calls.
 */

export type SiteTestimonial = {
  id: string;
  name: string;
  message: string;
  created_at: string; // ISO
  status: 'pending' | 'approved' | 'rejected';
};

const KEY = 'neuropost.site-testimonials.v1';
const EVENT = 'neuropost:site-testimonials-updated';

// Cached snapshot so useSyncExternalStore returns a stable reference when
// nothing has changed (React bails out on Object.is equality).
let snapshot: SiteTestimonial[] = [];
let snapshotLoaded = false;

function readAll(): SiteTestimonial[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SiteTestimonial[]) : [];
  } catch {
    return [];
  }
}

function refreshSnapshot() {
  snapshot = readAll();
  snapshotLoaded = true;
}

function writeAll(list: SiteTestimonial[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  snapshot = list;
  snapshotLoaded = true;
  window.dispatchEvent(new Event(EVENT));
}

export function getAllTestimonials(): SiteTestimonial[] {
  return readAll();
}

export function getApprovedTestimonials(): SiteTestimonial[] {
  return readAll().filter((t) => t.status === 'approved');
}

export function getPendingTestimonials(): SiteTestimonial[] {
  return readAll().filter((t) => t.status === 'pending');
}

export function addPendingTestimonial(input: { name: string; message: string }): SiteTestimonial {
  const t: SiteTestimonial = {
    id: `tst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || 'Anónimo',
    message: input.message.trim(),
    created_at: new Date().toISOString(),
    status: 'pending',
  };
  writeAll([t, ...readAll()]);
  return t;
}

export function approveTestimonial(id: string) {
  writeAll(readAll().map((t) => (t.id === id ? { ...t, status: 'approved' } : t)));
}

export function rejectTestimonial(id: string) {
  writeAll(readAll().map((t) => (t.id === id ? { ...t, status: 'rejected' } : t)));
}

export function deleteTestimonial(id: string) {
  writeAll(readAll().filter((t) => t.id !== id));
}

/** Subscribe to any change (same tab or cross-tab via storage event). */
export function subscribeTestimonials(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onLocal = () => { refreshSnapshot(); cb(); };
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { refreshSnapshot(); cb(); } };
  window.addEventListener(EVENT, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

/** Snapshot for useSyncExternalStore — must return a referentially stable value. */
export function getTestimonialsSnapshot(): SiteTestimonial[] {
  if (!snapshotLoaded) refreshSnapshot();
  return snapshot;
}

/** Server snapshot — no data available during SSR. */
export function getTestimonialsServerSnapshot(): SiteTestimonial[] {
  return [];
}
