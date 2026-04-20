import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PortalWorkerContext {
  workerId: string;
  userId: string;
  role: 'admin' | 'supervisor' | 'agent';
  name: string;
}

export function usePortalWorker() {
  const router = useRouter();
  const [worker, setWorker] = useState<PortalWorkerContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPortalWorkerAccess();
  }, []);

  async function checkPortalWorkerAccess() {
    try {
      setLoading(true);
      const res = await fetch('/api/worker/check');

      if (!res.ok) {
        setError('Access denied');
        router.push('/');
        return;
      }

      const data = await res.json();
      setWorker(data.worker);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error checking access');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return { worker, loading, error, isAuthorized: !error && worker !== null };
}
