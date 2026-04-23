import type { BrandMaterialCategory } from '@/types';

type DayHour = { day: string; hours: string };

export function contentToDisplay(
  cat: BrandMaterialCategory,
  content: Record<string, unknown>,
): string {
  if (cat === 'schedule') {
    const days = (content.days as DayHour[] | undefined) ?? [];
    if (!days.length) return 'Sin días configurados';
    return days.map(d => `${d.day}: ${d.hours}`).join(', ');
  }
  if (cat === 'promo')  return (content.title as string) || '—';
  if (cat === 'data')   return `${content.label ?? ''}${content.description ? ` — ${content.description}` : ''}`;
  if (cat === 'quote')  return (content.text as string) || '—';
  return (content.text as string) || '—';
}

export function emptyForm(cat: BrandMaterialCategory): Record<string, unknown> {
  if (cat === 'schedule') return { days: [] as DayHour[] };
  if (cat === 'promo')    return { title: '', description: '', url: '' };
  if (cat === 'data')     return { label: '', description: '' };
  if (cat === 'quote')    return { text: '', author: '' };
  return { text: '' };
}
