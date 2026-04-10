// =============================================================================
// POST /api/comments/[id]/auto-reply
// =============================================================================
//
// Generates an AI reply to a comment using the brand's voice + tone and
// posts it to Instagram/Facebook. Plan-gated: only Total and Agency plans
// (where `autoComments` is true in PLAN_LIMITS) can use this route.
//
// Manual replies still work on every plan via the existing
// POST /api/comments/[id]/reply route.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { replyToComment } from '@/lib/meta';
import { checkFeature } from '@/lib/plan-limits';
import type { Brand, Comment, BrandRules } from '@/types';

const client = new Anthropic();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user     = await requireServerUser();
    const { id }   = await params;
    const supabase = await createServerClient() as DB;

    // Load brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name, sector, tone, brand_voice_doc, ig_access_token, fb_access_token, rules, plan')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const typedBrand = brand as Brand;

    // Plan gate — auto-reply is a Total+ feature.
    const gate = await checkFeature(typedBrand.id, 'autoComments');
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason, upgradeUrl: gate.upgradeUrl }, { status: 402 });
    }

    // Load the comment
    const { data: comment } = await supabase
      .from('comments')
      .select('*')
      .eq('id', id)
      .eq('brand_id', typedBrand.id)
      .single();

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    const typedComment = comment as Comment;

    // Respect the user's "no auto-reply negative" rule — we don't want the
    // AI stepping on complaints before the user sees them.
    const rules = (typedBrand.rules ?? null) as BrandRules | null;
    if (rules?.noAutoReplyNegative && typedComment.sentiment === 'negative') {
      return NextResponse.json({
        error: 'El cliente ha desactivado las auto-respuestas a comentarios negativos.',
      }, { status: 422 });
    }

    // Build the AI reply.
    const constraints: string[] = [];
    if (rules?.forbiddenWords?.length) {
      constraints.push(`Evita estas palabras: ${rules.forbiddenWords.join(', ')}.`);
    }
    if (rules?.forbiddenTopics?.length) {
      constraints.push(`No toques estos temas: ${rules.forbiddenTopics.join(', ')}.`);
    }
    if (rules?.noEmojis) {
      constraints.push('No uses emojis.');
    }

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Eres ${typedBrand.name}, un negocio del sector ${typedBrand.sector ?? 'otro'}.
Tono de marca: ${typedBrand.tone ?? 'cercano'}.
Guía de voz: ${typedBrand.brand_voice_doc ?? 'Habla de forma clara, amable y profesional.'}
${constraints.length ? `\nREGLAS ESTRICTAS:\n${constraints.map(c => `- ${c}`).join('\n')}\n` : ''}
Tu tarea: escribir una respuesta corta (1-2 frases) al comentario del usuario. La respuesta debe ser auténtica, útil y en español. Devuelve SOLO la respuesta, sin comillas ni explicaciones.`,
      messages: [{
        role: 'user',
        content: `Comentario del usuario: "${typedComment.content ?? ''}"`,
      }],
    });

    const replyText = (message.content[0] as { type: string; text: string }).text?.trim() ?? '';
    if (!replyText) {
      return NextResponse.json({ error: 'La IA no generó respuesta' }, { status: 500 });
    }

    // Publish to Meta
    const accessToken = typedComment.platform === 'instagram'
      ? typedBrand.ig_access_token
      : typedBrand.fb_access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: `${typedComment.platform === 'instagram' ? 'Instagram' : 'Facebook'} no está conectado` },
        { status: 400 },
      );
    }

    const { replyId } = await replyToComment({
      commentId:   typedComment.external_id,
      message:     replyText,
      accessToken,
    });

    await supabase
      .from('comments')
      .update({ status: 'replied', ai_reply: replyText })
      .eq('id', id);

    await supabase.from('activity_log').insert({
      brand_id:    typedBrand.id,
      user_id:     user.id,
      action:      'comment_auto_replied',
      entity_type: 'comment',
      entity_id:   id,
      details:     { reply_id: replyId },
    });

    return NextResponse.json({ ok: true, reply: replyText, replyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
