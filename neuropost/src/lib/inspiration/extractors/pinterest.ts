// =============================================================================
// NEUROPOST — Pinterest URL extractor
// Pinterest is scrape-friendly: the pin page exposes og:image / og:video in
// standard OpenGraph meta tags on the public CDN (no auth, no rate-limit).
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { ExtractedMedia, ExtractedFile } from '../types';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── HTML fetch + OpenGraph parse ───────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers:  { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal:   AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pinterest HTML fetch ${res.status}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x3A;/g, ':')
    .replace(/&quot;/g, '"');
}

function getMeta(html: string, property: string): string | undefined {
  // Both orderings: property first or content first
  const re1 = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i');
  const m = html.match(re1) ?? html.match(re2);
  return m ? decodeEntities(m[1]) : undefined;
}

interface PinMeta {
  imageUrl: string | undefined;
  videoUrl: string | undefined;
}

function extractPinMeta(html: string): PinMeta {
  return {
    imageUrl: getMeta(html, 'og:image')
           ?? getMeta(html, 'og:image:secure_url'),
    videoUrl: getMeta(html, 'og:video')
           ?? getMeta(html, 'og:video:secure_url')
           ?? getMeta(html, 'og:video:url'),
  };
}

// ─── ffmpeg frame extraction (same approach as telegram-video) ──────────────

const FFMPEG = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function probeDurationSec(path: string): Promise<number> {
  return new Promise(resolve => {
    const proc = spawn(FFMPEG, ['-i', path], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (!m) return resolve(5);
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
  });
}

async function extractFrame(video: string, out: string, atSec: number): Promise<void> {
  await runFfmpeg(['-ss', String(atSec), '-i', video, '-frames:v', '1', '-q:v', '3', '-y', out]);
}

// ─── Downloads ──────────────────────────────────────────────────────────────

async function downloadBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers:  { 'User-Agent': UA },
    signal:   AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Download ${res.status} ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function extractPinterestUrl(url: string): Promise<ExtractedMedia> {
  const html = await fetchHtml(url);
  const meta = extractPinMeta(html);

  // Prefer video when both are present (pins can have a video + poster image)
  if (meta.videoUrl) {
    return extractVideoPin(meta.videoUrl);
  }
  if (meta.imageUrl) {
    return extractImagePin(meta.imageUrl);
  }
  throw new Error('Pinterest: no og:image or og:video found in the page');
}

async function extractImagePin(imageUrl: string): Promise<ExtractedMedia> {
  const buffer = await downloadBytes(imageUrl);
  // Guess mime from URL extension
  const mimeType =
    /\.png(\?|$)/i.test(imageUrl) ? 'image/png' :
    /\.webp(\?|$)/i.test(imageUrl) ? 'image/webp' :
    'image/jpeg';
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

  const file: ExtractedFile = {
    buffer,
    mimeType,
    filename: `pinterest-${Date.now()}.${ext}`,
  };
  return {
    mediaType:      'image',
    sourcePlatform: 'pinterest',
    sourceUrl:      imageUrl,
    files:          [file],
  };
}

async function extractVideoPin(videoUrl: string): Promise<ExtractedMedia> {
  const videoBuffer = await downloadBytes(videoUrl);

  const dir   = mkdtempSync(join(tmpdir(), 'np-pin-'));
  const vPath = join(dir, 'input.mp4');
  writeFileSync(vPath, videoBuffer);

  try {
    const duration = await probeDurationSec(vPath);
    const timestamps = [
      Math.max(0.1, duration * 0.2),
      duration * 0.5,
      Math.max(0.1, duration * 0.8),
    ];
    const frames: ExtractedFile[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const fp = join(dir, `f-${i}.jpg`);
      await extractFrame(vPath, fp, timestamps[i]);
      frames.push({
        buffer:   readFileSync(fp),
        mimeType: 'image/jpeg',
        filename: `pinterest-frame-${Date.now()}-${i}.jpg`,
      });
    }
    const video: ExtractedFile = {
      buffer:   videoBuffer,
      mimeType: 'video/mp4',
      filename: `pinterest-${Date.now()}.mp4`,
    };
    return {
      mediaType:      'video',
      sourcePlatform: 'pinterest',
      sourceUrl:      videoUrl,
      files:          [video, ...frames],
    };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}
