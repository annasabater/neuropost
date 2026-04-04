'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect /captacion/email → /captacion/email/respuestas
export default function EmailPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/captacion/email/respuestas'); }, [router]);
  return null;
}
