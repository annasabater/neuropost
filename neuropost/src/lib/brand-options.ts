import type { SocialSector, BrandTone, PublishMode } from '@/types';

export const SECTOR_OPTIONS: { value: SocialSector; label: string; emoji: string }[] = [
  { value: 'heladeria',    label: 'Heladería',             emoji: '🍦' },
  { value: 'restaurante',  label: 'Restaurante',           emoji: '🍽️' },
  { value: 'cafeteria',    label: 'Cafetería',             emoji: '☕' },
  { value: 'gym',          label: 'Gimnasio',              emoji: '💪' },
  { value: 'clinica',      label: 'Clínica / Salud',       emoji: '🏥' },
  { value: 'barberia',     label: 'Barbería / Peluquería', emoji: '✂️' },
  { value: 'boutique',     label: 'Boutique / Moda',       emoji: '👗' },
  { value: 'inmobiliaria', label: 'Inmobiliaria',          emoji: '🏠' },
  { value: 'otro',         label: 'Otro negocio',          emoji: '🏪' },
];

export const TONE_OPTIONS: { value: BrandTone; label: string; desc: string }[] = [
  { value: 'cercano',     label: 'Cercano',     desc: 'Amigable y conversacional' },
  { value: 'profesional', label: 'Profesional', desc: 'Formal y confiable' },
  { value: 'divertido',   label: 'Divertido',   desc: 'Energético y con humor' },
  { value: 'premium',     label: 'Premium',     desc: 'Elegante y exclusivo' },
];

export const PUBLISH_MODE_OPTIONS: { value: PublishMode; label: string; desc: string; emoji: string }[] = [
  { value: 'semi',   label: 'Supervisado',     desc: 'Tú apruebas cada post antes de que lo publiquemos',   emoji: '⚡' },
  { value: 'auto',   label: 'Automático',      desc: 'Publicamos sin que tengas que aprobar cada post',      emoji: '🤖' },
];