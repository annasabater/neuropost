#!/usr/bin/env bash
# Symlinks scoped packages from monorepo root into neuropost/node_modules
# so Turbopack can find them without traversing parent directories.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)/node_modules"
NP="$(cd "$(dirname "$0")/.." && pwd)/node_modules"

SCOPES="@supabase @opentelemetry @sentry @anthropic-ai @dnd-kit @fal-ai @ffmpeg-installer @parcel @react-email @stripe @tailwindcss"

for scope in $SCOPES; do
  mkdir -p "$NP/$scope"
  for pkg in $(ls "$ROOT/$scope/" 2>/dev/null); do
    ln -sf "$ROOT/$scope/$pkg" "$NP/$scope/$pkg" 2>/dev/null || true
  done
done

echo "[link-workspace-deps] Done."
