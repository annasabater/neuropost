// =============================================================================
// NEUROPOST — Telegram Bot API helpers
// Thin wrappers around api.telegram.org for the inspiration bot.
// =============================================================================

const API_BASE = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return t;
}

async function tgFetch(
  method: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    // Telegram is usually fast; don't hang the webhook handler
    signal:  AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>');
    throw new Error(`Telegram ${method} ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  chatId: number | string,
  text:   string,
  options: {
    reply_to_message_id?: number;
    parse_mode?:          'HTML' | 'MarkdownV2';
    disable_notification?: boolean;
  } = {},
): Promise<void> {
  try {
    await tgFetch('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  } catch (err) {
    console.warn('[telegram] sendMessage failed:', err);
  }
}

export async function sendTelegramPhoto(
  chatId:  number | string,
  photoUrl: string,
  caption?: string,
): Promise<void> {
  try {
    await tgFetch('sendPhoto', {
      chat_id: chatId,
      photo:   photoUrl,
      caption,
    });
  } catch (err) {
    console.warn('[telegram] sendPhoto failed:', err);
  }
}

// ─── File download ───────────────────────────────────────────────────────────

interface TelegramGetFileResult {
  ok:     boolean;
  result: { file_id: string; file_path: string; file_size?: number };
}

/**
 * Downloads a Telegram file by file_id.
 * 1. Calls getFile to resolve the file_path.
 * 2. Downloads from https://api.telegram.org/file/bot<TOKEN>/<path>
 */
export async function getTelegramFile(fileId: string): Promise<Buffer> {
  // Step 1: resolve file path
  const getFileRes = await fetch(
    `${API_BASE}/bot${token()}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!getFileRes.ok) {
    throw new Error(`Telegram getFile failed: ${getFileRes.status}`);
  }
  const getFileJson = (await getFileRes.json()) as TelegramGetFileResult;
  if (!getFileJson.ok || !getFileJson.result?.file_path) {
    throw new Error('Telegram getFile: missing file_path');
  }

  // Step 2: download the actual file bytes
  const fileUrl = `${API_BASE}/file/bot${token()}/${getFileJson.result.file_path}`;
  const fileRes = await fetch(fileUrl, { signal: AbortSignal.timeout(60_000) });
  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: ${fileRes.status}`);
  }
  const arr = await fileRes.arrayBuffer();
  return Buffer.from(arr);
}
