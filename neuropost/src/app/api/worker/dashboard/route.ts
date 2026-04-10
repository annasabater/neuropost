import { NextResponse } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const worker = await requireWorker();
    const db = createAdminClient();

    // Get worker's assigned brands
    const brandIds = worker.brands_assigned ?? [];

    // Fetch all data in parallel
    const [postsRes, specialReqRes, recreationReqRes, mediaRes] = await Promise.all([
      // Posts by state
      db
        .from('posts')
        .select('id, brand_id, image_url, edited_image_url, caption, status, created_at, brands(id, name)')
        .in('brand_id', brandIds.length > 0 ? brandIds : [])
        .order('created_at', { ascending: false }),

      // Special requests (solicitudes)
      db
        .from('special_requests')
        .select('id, brand_id, title, description, type, status, deadline_at, created_at, brands(id, name)')
        .in('brand_id', brandIds.length > 0 ? brandIds : [])
        .order('created_at', { ascending: false }),

      // Recreation requests (solicitudes de recreación)
      db
        .from('recreation_requests')
        .select('id, brand_id, client_notes, style_to_adapt, status, created_at, inspiration_references(title, thumbnail_url), brands(id, name)')
        .in('brand_id', brandIds.length > 0 ? brandIds : [])
        .order('created_at', { ascending: false }),

      // Media gallery (posts with images grouped by brand)
      db
        .from('posts')
        .select('id, brand_id, image_url, edited_image_url, caption, status, created_at, brands(id, name)')
        .in('brand_id', brandIds.length > 0 ? brandIds : [])
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const posts = postsRes.data ?? [];
    const specialRequests = specialReqRes.data ?? [];
    const recreationRequests = recreationReqRes.data ?? [];
    const mediaGallery = mediaRes.data ?? [];

    // Organize posts by state
    const postsByState = {
      preparacion: posts.filter((p: any) => ['request', 'draft'].includes(p.status)),
      pendiente: posts.filter((p: any) => ['pending', 'generated'].includes(p.status)),
      planificado: posts.filter((p: any) => p.status === 'scheduled'),
      publicado: posts.filter((p: any) => p.status === 'published'),
    };

    return NextResponse.json({
      postsByState,
      specialRequests,
      recreationRequests,
      mediaGallery,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
