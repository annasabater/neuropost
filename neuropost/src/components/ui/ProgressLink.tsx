'use client';

import Link from 'next/link';
import NProgress from 'nprogress';
import type { ComponentProps } from 'react';

export function ProgressLink({ href, children, onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        NProgress.start();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}
