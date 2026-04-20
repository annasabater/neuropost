// =============================================================================
// NEUROPOST — Template resolver
// getTemplate(name, locale) returns the factory that produces the subject/html
// for the requested template in the requested language. Falls back to 'es'.
// =============================================================================

import { templates as es } from './es';
import { templates as en } from './en';
import { templates as fr } from './fr';
import { templates as pt } from './pt';

import type { EmailTemplates } from './shared';
import type { SupportedLanguage } from '../preferences';

const BY_LOCALE: Record<SupportedLanguage, EmailTemplates> = { es, en, fr, pt };

export function getTemplateSet(locale: string): EmailTemplates {
  return BY_LOCALE[(locale as SupportedLanguage)] ?? BY_LOCALE.es;
}

/** Typed factory getter — prevents typos and keeps the call site clean. */
export function getTemplate<K extends keyof EmailTemplates>(
  name:   K,
  locale: string,
): EmailTemplates[K] {
  return getTemplateSet(locale)[name];
}

export type { EmailTemplates } from './shared';
export * from './shared';
