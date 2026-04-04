'use client';

import { useRouter } from 'next/navigation';
import { PostEditor } from '@/components/posts/PostEditor';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import toast from 'react-hot-toast';

export default function NewPostPage() {
  const router   = useRouter();
  const brand    = useAppStore((s) => s.brand);
  const addPost  = useAppStore((s) => s.addPost);

  const allowStories = PLAN_LIMITS[brand?.plan ?? 'starter'].storiesPerWeek > 0;

  async function handleSave(data: {
    imageUrl:       string | null;
    caption:        string;
    hashtags:       string[];
    platforms:      ('instagram' | 'facebook')[];
    format:         string;
    goal:           string;
    aiExplanation?: string;
    qualityScore?:  number;
    isStory?:       boolean;
  }) {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url:      data.imageUrl,
        caption:        data.caption,
        hashtags:       data.hashtags,
        platform:       data.platforms,
        format:         data.format,
        status:         'generated',
        ai_explanation: data.aiExplanation ?? null,
        quality_score:  data.qualityScore  ?? null,
        is_story:       data.isStory ?? false,
        story_type:     data.isStory ? 'new' : null,
        versions:       [],
        edit_level:     0,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
    addPost(json.post);
    toast.success('Post guardado correctamente');
    router.push(`/posts/${json.post.id}`);
  }

  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Nuevo post</h1>
          <p className="page-sub">Sube una imagen, analiza con IA y genera el copy</p>
        </div>
      </div>
      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
