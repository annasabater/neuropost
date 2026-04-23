'use client';

import type { Brand }      from '@/types';
import { IdentityCard }    from './IdentityCard';
import { CommunicationCard } from './CommunicationCard';
import { PublicationCard } from './PublicationCard';

interface Props {
  brand:             Brand;
  contentRulesCount: number;
}

export function BrandKitSummaryGrid({ brand, contentRulesCount }: Props) {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap:                 12,
    }}>
      <IdentityCard      brand={brand} />
      <CommunicationCard brand={brand} />
      <PublicationCard   brand={brand} contentRulesCount={contentRulesCount} />
    </div>
  );
}
