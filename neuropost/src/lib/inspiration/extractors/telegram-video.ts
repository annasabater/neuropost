// =============================================================================
// NEUROPOST — Telegram video extractor
// Downloads the Telegram video → extracts 3 JPEG frames (start / middle / end)
// via ffmpeg → returns the video + frames as ExtractedMedia.
//
// NOTE: Telegram Bot API caps getFile downloads at 20 MB. Videos larger than
// that will throw "file is too big" here.
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { getTelegramFile } from '../telegram-api';
import type { ExtractedMedia, ExtractedFile } from '../types';

const FFMPEG = ffmpegInstaller.path;

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/** Run ffprobe-like duration detection via ffmpeg itself. */
async function probeDurationSec(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, ['-i', videoPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (!m) return resolve(5);   // fallback
      const hours = Number(m[1]), mins = Number(m[2]), secs = Number(m[3]);
      resolve(hours * 3600 + mins * 60 + secs);
    });
  });
}

async function extractFrame(videoPath: string, outPath: string, atSec: number): Promise<void> {
  await runFfmpeg([
    '-ss', String(atSec),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '3',
    '-y',
    outPath,
  ]);
}

export async function extractTelegramVideo(fileId: string): Promise<ExtractedMedia> {
  const videoBuffer = await getTelegramFile(fileId);

  // Work in a scratch dir
  const dir       = mkdtempSync(join(tmpdir(), 'np-vid-'));
  const videoPath = join(dir, 'input.mp4');
  writeFileSync(videoPath, videoBuffer);

  try {
    const duration = await probeDurationSec(videoPath);
    // Sample at 20%, 50%, 80% — stays inside even very short clips
    const timestamps = [
      Math.max(0.1, duration * 0.2),
      duration * 0.5,
      Math.max(0.1, duration * 0.8),
    ];

    const frames: ExtractedFile[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = join(dir, `frame-${i}.jpg`);
      await extractFrame(videoPath, framePath, timestamps[i]);
      frames.push({
        buffer:   readFileSync(framePath),
        mimeType: 'image/jpeg',
        filename: `telegram-${fileId}-frame-${i}.jpg`,
      });
    }

    const videoFile: ExtractedFile = {
      buffer:   videoBuffer,
      mimeType: 'video/mp4',
      filename: `telegram-${fileId}.mp4`,
    };

    return {
      mediaType:      'video',
      sourcePlatform: 'telegram_direct',
      sourceUrl:      null,
      // Convention: files[0] = video, files[1..] = frames
      files:          [videoFile, ...frames],
    };
  } finally {
    // Clean scratch dir even on error
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}
