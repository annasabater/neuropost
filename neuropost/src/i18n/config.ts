export const locales = ['es', 'en', 'fr', 'pt', 'ca'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'es';

export const localeNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
  ca: 'Català',
};

export const localeFlags: Record<Locale, string> = {
  es: '🇪🇸',
  en: '🇬🇧',
  fr: '🇫🇷',
  pt: '🇵🇹',
  ca: '🏴󠁥󠁳󠁣󠁴󠁿',
};
