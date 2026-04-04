'use client';

import { useAppStore } from '@/store/useAppStore';
import { BrandKitEditor } from '@/components/brand/BrandKitEditor';

export default function BrandPage() {
  const brand        = useAppStore((s) => s.brand);
  const brandLoading = useAppStore((s) => s.brandLoading);

  if (brandLoading) {
    return (
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-state-icon">🎨</div>
          <p className="empty-state-title">Completa el onboarding primero</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Brand Kit</h1>
          <p className="page-sub">Define los elementos visuales y el tono de tu marca</p>
        </div>
      </div>
      <BrandKitEditor brand={brand} />
    </div>
  );
}
