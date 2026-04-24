import type { BrandMaterialCategory } from '@/types';

type DayHour = { day: string; hours: string };

export function contentToDisplay(
  cat: BrandMaterialCategory,
  content: Record<string, unknown>,
): string {
  if (cat === 'schedule') {
    // v2 format: content.schedules[].days
    if (content.schema_version === 2 && Array.isArray(content.schedules)) {
      const schedules = content.schedules as Array<{ label?: string; days?: DayHour[] }>;
      const allDays = schedules.flatMap(s => s.days ?? []);
      if (!allDays.length) return 'Sin días configurados';
      const DAY_ES: Record<string, string> = {
        monday: 'L', tuesday: 'M', wednesday: 'X', thursday: 'J',
        friday: 'V', saturday: 'S', sunday: 'D',
      };
      return schedules
        .filter(s => (s.days ?? []).length > 0)
        .map(s => {
          const label = s.label ? `${s.label}: ` : '';
          const dias = (s.days ?? []).map(d => DAY_ES[d.day] ?? d.day).join('');
          const hours = s.days?.[0]?.hours ?? '';
          return `${label}${dias} ${hours}`.trim();
        })
        .join(' · ');
    }
    // v1 format: content.days
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
