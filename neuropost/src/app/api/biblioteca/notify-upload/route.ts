// =============================================================================
// POST /api/biblioteca/notify-upload — notify system of first media upload
// =============================================================================
// Called by the client-side biblioteca page after uploading media.
// Triggers onboarding content generation if this is the brand's first upload.
// Lightweight endpoint — does not process the upload itself.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;

    const { data: brand } = await db
      .from('brands')
      .select('id, onboarding_content_triggered')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ ok: true }); // silently skip

    // Only trigger if not already done
    if (!brand.onboarding_content_triggered) {
      const { triggerOnboardingContent } = await import('@/lib/onboarding-content');
      await triggerOnboardingContent(brand.id, 'media_upload');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'POST /api/biblioteca/notify-upload');
  }
}
