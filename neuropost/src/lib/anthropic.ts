// =============================================================================
// NEUROPOST — Anthropic SDK singleton
// Shared client for features that need it. Existing agents instantiate their
// own clients — do not refactor them without reason.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
