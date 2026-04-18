// =============================================================================
// NEUROPOST — Telegram webhook (inspiration bank ingestion)
// Receives updates from Telegram, validates, and pushes jobs to
// inspiration_queue for the cron processor.
// Phase 3: only photos from the authorised owner.
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
interface TelegramMessage {
  message_id: number;
  from?:      { id: number; is_bot?: boolean; first_name?: string };
  chat:       { id: number };
  text?:      string;
  caption?:   string;
  photo?:     TelegramPhotoSize[];
  video?:     { file_id: string };
  document?:  { file_id: string; mime_type?: string };
  media_group_id?: string;
}
interface TelegramUpdate {
  update_id: number;
  message?:  TelegramMessage;
}

const HELP_TEXT = `🎨 *NeuroPost Inspiration Bot*

Envíame una foto (o varias) y la añadiré al banco de inspiración. Claude Vision la describirá y clasificará automáticamente.

Comandos:
/start — muestra esta ayuda
/help  — muestra esta ayuda

Pronto: vídeos, carruseles y enlaces de Instagram/TikTok.`;

export async function POST(request: Request) {
  try {
    // ── 1. Verify secret header ──────────────────────────────────────────────
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

    // ── 2. Owner gate ────────────────────────────────────────────────────────
    const ownerId = Number(process.env.TELEGRAM_OWNER_ID ?? '0');
    if (!ownerId || msg.from?.id !== ownerId) {
      await sendTelegramMessage(msg.chat.id, '⛔ No autorizado.');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── 3. Commands ──────────────────────────────────────────────────────────
    const text = (msg.text ?? '').trim();
    if (text === '/start' || text === '/help') {
      await sendTelegramMessage(msg.chat.id, HELP_TEXT, { parse_mode: 'MarkdownV2' });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── 4. Photos → queue ────────────────────────────────────────────────────
    if (msg.photo && msg.photo.length > 0) {
      // Largest version = last item
      const largest = msg.photo[msg.photo.length - 1];
      const supabase = createAdminClient() as DB;

      const { error: insErr } = await supabase.from('inspiration_queue').insert({
        source: 'telegram_photo',
        payload: {
          file_id: largest.file_id,
          caption: msg.caption ?? null,
        },
        telegram_chat_id:    msg.chat.id,
        telegram_message_id: msg.message_id,
        media_group_id:      msg.media_group_id ?? null,
        status:              'pending',
      });

      if (insErr) {
        console.error('[telegram] queue insert failed:', insErr);
        await sendTelegramMessage(
          msg.chat.id,
          `❌ Error al encolar: ${insErr.message.slice(0, 150)}`,
          { reply_to_message_id: msg.message_id },
        );
      } else {
        await sendTelegramMessage(
          msg.chat.id,
          '⏳ Recibido, procesando…',
          { reply_to_message_id: msg.message_id },
        );
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── 5. Other media → not yet supported ───────────────────────────────────
    if (msg.video || msg.document) {
      await sendTelegramMessage(
        msg.chat.id,
        '📎 Por ahora solo acepto fotos. Vídeos y documentos llegan en la siguiente fase.',
        { reply_to_message_id: msg.message_id },
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ── 6. Fallback ──────────────────────────────────────────────────────────
    if (text) {
      await sendTelegramMessage(
        msg.chat.id,
        'Envíame una foto para añadirla al banco. Usa /help para ver los comandos.',
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Swallow all errors — never return 5xx to Telegram (it would retry)
    console.error('[telegram] webhook error:', err);
    apiError(err, 'POST /api/telegram/webhook');
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
