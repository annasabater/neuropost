// ─────────────────────────────────────────────────────────────────────────────
//  /instagram — legacy route.
//
//  The single-platform Instagram feed page has been replaced by the
//  multi-platform /feed with three tabs. We keep this route so any
//  existing bookmarks / notification links / deep-links keep landing
//  on the right content: redirect to /feed with Instagram pre-selected.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation';

export default function InstagramRedirect() {
  redirect('/feed?platform=instagram');
}
