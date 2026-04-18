// =============================================================================
// NEUROPOST — Telegram webhook (inspiration bank ingestion)
// Handles: photos (single + media_group carousels), videos, and admin commands.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/inspiration/telegram-api';
import { apiError } from '@/lib/api-utils';

export const runtime     = 'nodejs';
export const maxDuration = 10;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface TelegramPhotoSize { file_id: string; file_size?: number; width: number; height: number; }
interface TelegramVideo     { file_id: string; file_size?: number; duration?: number; mime_type?: string; }
interface TelegramMessage {
  message_id: number;
  from?:      { id: number };
  chat:       { id: number };
  text?:      string;
  caption?:   string;
  photo?:     TelegramPhotoSize[];
  video?:     TelegramVideo;
  document?:  { file_id: string; mime_type?: string };
  media_group_id?: string;
}
interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

const HELP_TEXT = `🎨 *NeuroPost Inspiration Bot*

Envíame fotos carruseles o vídeos y los añadiré al banco\\.

*Para reels de Instagram o TikTok:*
1\\. Pega el link en [@Savetelbot](https://t.me/Savetelbot) \\(Instagram\\) o [@tiktokdownloader\\_bot](https://t.me/tiktokdownloader_bot) \\(TikTok\\)
2\\. Cuando te devuelva el vídeo reenvíamelo aquí
3\\. Yo lo proceso como si fuera tuyo

*Comandos:*
/start \\- esta ayuda
/help \\- esta ayuda
/stats \\- cuántos items hay en el banco
/recent \\- últimos 10 items
/delete \\<id\\> \\- borra un item por id

Nota: vídeos hasta 20 MB \\(límite de Telegram Bot API\\)\\.`;

// Detect social URLs in plain-text messages to guide the user
const URL_PATTERNS: { re: RegExp; name: string; helper: string }[] = [
  { re: /instagram\.com\/(reel|p|tv)\//i,   name: 'Instagram',
    helper: 'pega el link en @Savetelbot, espera el vídeo, y reenvíamelo aquí' },
  { re: /tiktok\.com\/.*\/video\/|vm\.tiktok|vt\.tiktok/i, name: 'TikTok',
    helper: 'pega el link en @tiktokdownloader_bot, espera el vídeo, y reenvíamelo aquí' },
  { re: /pinterest\.com\/pin\/|pin\.it\//i, name: 'Pinterest',
    helper: 'abre el pin, toca el botón compartir → copiar imagen, y envíame la imagen aquí' },
  { re: /youtube\.com\/|youtu\.be\//i,      name: 'YouTube',
    helper: 'YouTube no está soportado — usa Instagram, TikTok o Pinterest' },
];

function detectSocialUrl(text: string): { name: string; helper: string } | null {
  for (const p of URL_PATTERNS) {
    if (p.re.test(text)) return { name: p.name, helper: p.helper };
  }
  return null;
}

// ─── Command handlers ───────────────────────────────────────────────────────

async function handleStats(chatId: number, replyTo: number) {
  const supabase = createAdminClient() as DB;
  const { count: totalBank } = await supabase
    .from('inspiration_bank')
    .select('id', { count: 'exact', head: true });
  const { count: pending } = await supabase
    .from('inspiration_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  const { count: failed } = await supabase
    .from('inspiration_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');

  // Top 5 categories
  const { data: items } = await supabase
    .from('inspiration_bank')
    .select('category')
    .limit(2000);
  const counts = new Map<string, number>();
  for (const r of (items ?? []) as { category: string }[]) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c, n]) => `• ${c}: ${n}`)
    .join('\n');

  await sendTelegramMessage(
    chatId,
    `📊 Banco: ${totalBank ?? 0}\nPendientes: ${pending ?? 0} · Fallidos: ${failed ?? 0}\n\nTop categorías:\n${top || '—'}`,
    { reply_to_message_id: replyTo },
  );
}

async function handleRecent(chatId: number, replyTo: number) {
  const supabase = createAdminClient() as DB;
  const { data } = await supabase
    .from('inspiration_bank')
    .select('id, media_type, category, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    await sendTelegramMessage(chatId, 'Sin items en el banco.', { reply_to_message_id: replyTo });
    return;
  }

  const lines = (data as { id: string; media_type: string; category: string; tags: string[]; created_at: string }[])
    .map(r => `• ${r.id.slice(0, 8)} · ${r.media_type} · ${r.category} · ${(r.tags ?? []).slice(0, 3).join(',')}`)
    .join('\n');

  await sendTelegramMessage(chatId, `Últimos 10:\n${lines}`, { reply_to_message_id: replyTo });
}

async function handleDelete(chatId: number, replyTo: number, text: string) {
  const arg = text.replace(/^\/delete\s*/i, '').trim();
  if (!arg) {
    await sendTelegramMessage(chatId, 'Uso: /delete <id> (los primeros 8 chars bastan)', { reply_to_message_id: replyTo });
    return;
  }
  const supabase = createAdminClient() as DB;
  const { data: matches } = await supabase
    .from('inspiration_bank')
    .select('id')
    .ilike('id', `${arg}%`)
    .limit(2);
  if (!matches || matches.length === 0) {
    await sendTelegramMessage(chatId, `No encontré ningún item con id "${arg}"`, { reply_to_message_id: replyTo });
    return;
  }
  if (matches.length > 1) {
    await sendTelegramMessage(chatId, `Prefijo ambiguo "${arg}" — sé más específico`, { reply_to_message_id: replyTo });
    return;
  }
  const fullId = (matches[0] as { id: string }).id;
  await supabase.from('inspiration_bank').delete().eq('id', fullId);
  await sendTelegramMessage(chatId, `🗑️ Borrado ${fullId}`, { reply_to_message_id: replyTo });
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[telegram] TELEGRAM_WEBHOOK_SECRET not configured');
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    const got = request.headers.get('x-telegram-bot-api-secret-token');
    if (got !== expectedSecret) {
      console.warn('[telegram] Invalid secret header');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const update = (await request.json()) as TelegramUpdate;
    const msg    = update.message;
    if (!msg) return NextResponse.json({ ok: true }, { status: 200 });

    const ownerId = Number(process.env.TELEGRAM_OWNER_ID ?? '0');
    if (!ownerId || msg.from?.id !== ownerId) {
      await sendTelegramMessage(msg.chat.id, '⛔ No autorizado.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const text = (msg.text ?? '').trim();

    // ── Commands ──
    if (text === '/start' || text === '/help') {
      await sendTelegramMessage(msg.chat.id, HELP_TEXT, { parse_mode: 'MarkdownV2' });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (text === '/stats') {
      await handleStats(msg.chat.id, msg.message_id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (text === '/recent') {
      await handleRecent(msg.chat.id, msg.message_id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (text.startsWith('/delete')) {
      await handleDelete(msg.chat.id, msg.message_id, text);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const supabase = createAdminClient() as DB;

    // ── Photos → queue (carousels are grouped later by the ingest cron) ──
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      const { error } = await supabase.from('inspiration_queue').insert({
        source:  'telegram_photo',
        payload: { file_id: largest.file_id, caption: msg.caption ?? null },
        telegram_chat_id:    msg.chat.id,
        telegram_message_id: msg.message_id,
        media_group_id:      msg.media_group_id ?? null,
        status: 'pending',
      });
      if (error) {
        await sendTelegramMessage(msg.chat.id, `❌ Error al encolar: ${error.message.slice(0, 150)}`,
          { reply_to_message_id: msg.message_id });
      } else if (!msg.media_group_id) {
        // Don't spam "recibido" once per slide of a carousel; only reply on singletons
        await sendTelegramMessage(msg.chat.id, '⏳ Recibido, procesando…',
          { reply_to_message_id: msg.message_id });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── Video → queue ──
    if (msg.video) {
      const { error } = await supabase.from('inspiration_queue').insert({
        source:  'telegram_video',
        payload: { file_id: msg.video.file_id, caption: msg.caption ?? null,
                   duration: msg.video.duration ?? null },
        telegram_chat_id:    msg.chat.id,
        telegram_message_id: msg.message_id,
        status: 'pending',
      });
      if (error) {
        await sendTelegramMessage(msg.chat.id, `❌ Error al encolar vídeo: ${error.message.slice(0, 150)}`,
          { reply_to_message_id: msg.message_id });
      } else {
        await sendTelegramMessage(msg.chat.id, '⏳ Vídeo recibido, extrayendo frames…',
          { reply_to_message_id: msg.message_id });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── Documents / other ──
    if (msg.document) {
      await sendTelegramMessage(msg.chat.id,
        '📎 Los documentos aún no se soportan. Envía la foto o vídeo directamente.',
        { reply_to_message_id: msg.message_id });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── Plain text fallback ──
    if (text) {
      const social = detectSocialUrl(text);
      if (social) {
        await sendTelegramMessage(msg.chat.id,
          `🔗 Detecté un link de ${social.name}. No puedo bajarlo directo, pero ${social.helper}.`,
          { reply_to_message_id: msg.message_id });
      } else {
        await sendTelegramMessage(msg.chat.id,
          'Envíame una foto, carrusel o vídeo. Usa /help para ver los comandos.');
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[telegram] webhook error:', err);
    apiError(err, 'POST /api/telegram/webhook');
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
