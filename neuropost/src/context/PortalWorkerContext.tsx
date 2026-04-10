'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PortalWorker {
  workerId: string;
  userId: string;
  role: 'admin' | 'supervisor' | 'agent';
  name: string;
}

interface PortalWorkerContextType {
  worker: PortalWorker | null;
  loading: boolean;
  error: string | null;
}

const PortalWorkerContext = createContext<PortalWorkerContextType | undefined>(undefined);

export function PortalWorkerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [worker, setWorker] = useState<PortalWorker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const res = await fetch('/api/worker/check');
      if (!res.ok) {
        setError('Access denied');
        router.push('/');
        return;
      }
      const data = await res.json();
      setWorker(data.worker);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalWorkerContext.Provider value={{ worker, loading, error }}>
      {children}
    </PortalWorkerContext.Provider>
  );
}

export function usePortalWorkerContext() {
  const context = useContext(PortalWorkerContext);
  if (!context) {
    throw new Error('usePortalWorkerContext must be used within PortalWorkerProvider');
  }
  return context;
}
