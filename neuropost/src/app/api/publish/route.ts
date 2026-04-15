import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser } from '@/lib/supabase';
import { requirePermission } from '@/lib/rbac';
import { createAdminClient } from '@/lib/supabase';
import { publishPostById } from '@/lib/publishPost';
import type { Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const user       = await requireServerUser();
    const { postId } = await request.json() as { postId: string };

    // Check publish permission
    const supabase = createAdminClient();
    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const typedBrand = brand as Brand;

    const permErr = await requirePermission(user.id, typedBrand.id, 'publish_post');
    if (permErr) return permErr;

    const result = await publishPostById(postId, user.id);

    // Email notification (if enabled)
    try {
      const { data: brandFull } = await supabase.from('brands').select('notify_email_publish').eq('id', typedBrand.id).single();
      if (brandFull?.notify_email_publish) {
        const { sendPostPublishedEmail } = await import('@/lib/email');
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const email = authUser?.user?.email;
        const { data: post } = await supabase.from('posts').select('platform').eq('id', postId).single();
        if (email && post) {
          const platforms = Array.isArray(post.platform) ? post.platform.join(' y ') : post.platform;
          await sendPostPublishedEmail(email, postId, platforms);
        }
      }
    } catch { /* email failure never blocks publish */ }

    return NextResponse.json({
      ok:          result.ok,
      publishedAt: result.publishedAt,
      igPostId:    result.igPostId,
    });
  } catch (err) {
    return apiError(err, 'publish');
  }
}
