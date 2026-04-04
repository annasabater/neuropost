'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

NProgress.configure({ minimum: 0.1, easing: 'ease', speed: 300, showSpinner: false, trickleSpeed: 80 });

function ProgressBarInner() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  return null;
}

export function PageProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
