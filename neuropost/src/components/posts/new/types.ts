import type { PostFormat, SourceType } from '@/types';
import type { SelectedMedia } from '@/components/posts/MediaPicker';

export type PostObjective = 'vender' | 'informar' | 'conectar' | 'ensenar' | 'demostrar';
export type DeliveryMode  = 'instant' | 'reviewed';

export interface PerMediaMeta {
  note:          string;
  inspirationId: string | null;
}

export interface PostFormState {
  // S1 – media
  selectedMedia:  SelectedMedia[];
  perMedia:       Record<string, PerMediaMeta>;
  // S2 – objective
  objective:      PostObjective | null;
  // S3 – subtype
  subtype:        string | null;
  activePlaceholder: string;
  // S4 – description
  description:    string;
  // S5 – format
  outputFormat:   PostFormat;
  videoDuration:  number;
  extraGenerated: number;
  // S6 – timing
  timingPreset:   'today' | 'tomorrow' | 'week' | 'custom' | null;
  preferredDate:  string;
  // S7 – platforms
  platforms:      Array<'instagram' | 'facebook' | 'tiktok'>;
  // S8 – extras
  extraNotes:         string;
  proposedCaption:    string;
  globalInspirationIds: string[];
  // delivery
  deliveryMode:   DeliveryMode;
}

export const DEFAULT_FORM_STATE: PostFormState = {
  selectedMedia:        [],
  perMedia:             {},
  objective:            null,
  subtype:              null,
  activePlaceholder:    'Describe qué quieres en esta publicación...',
  description:          '',
  outputFormat:         'image',
  videoDuration:        10,
  extraGenerated:       0,
  timingPreset:         null,
  preferredDate:        '',
  platforms:            ['instagram'],
  extraNotes:           '',
  proposedCaption:      '',
  globalInspirationIds: [],
  deliveryMode:         'reviewed',
};

export function deriveSourceType(media: SelectedMedia[]): SourceType {
  if (media.length === 0) return 'none';
  if (media.some((m) => m.type === 'video')) return 'video';
  return 'photos';
}

export const OBJECTIVES: { v: PostObjective; l: string; desc: string }[] = [
  { v: 'vender',    l: 'Vender',         desc: 'Promociones, ofertas, llamadas a reserva o compra' },
  { v: 'informar',  l: 'Informar',        desc: 'Novedades, eventos, horarios, recordatorios' },
  { v: 'conectar',  l: 'Conectar',        desc: 'Equipo, detrás de cámara, historia, preguntas' },
  { v: 'ensenar',   l: 'Enseñar',         desc: 'Tips, tutoriales, mitos, comparativas, datos' },
  { v: 'demostrar', l: 'Demostrar valor', desc: 'Testimonios, antes/después, casos de éxito' },
];

export const SUBTYPES: Record<PostObjective, { v: string; l: string; placeholder: string }[]> = {
  vender: [
    { v: 'promo',        l: 'Promoción / descuento',  placeholder: '¿Qué ofreces, desde cuándo, hasta cuándo, condiciones?' },
    { v: 'producto',     l: 'Destacar producto',       placeholder: '¿Qué producto quieres destacar? ¿Qué lo hace especial?' },
    { v: 'reserva',      l: 'Llamada a reserva',       placeholder: '¿Qué servicio ofreces? ¿Cómo se reserva? ¿Hay plazas limitadas?' },
    { v: 'sorteo',       l: 'Sorteo / concurso',       placeholder: '¿Qué sorteas? ¿Cómo participar? ¿Cuándo acaba?' },
    { v: 'novedad',      l: 'Novedad / lanzamiento',   placeholder: 'Presenta un producto o servicio. ¿Qué cambia o es nuevo?' },
    { v: 'colaboracion', l: 'Colaboración',            placeholder: '¿Con quién colaboras? ¿Qué hacéis juntos?' },
  ],
  informar: [
    { v: 'evento',       l: 'Evento',                 placeholder: '¿Qué evento, cuándo, dónde, cómo se apuntan?' },
    { v: 'horarios',     l: 'Horarios / cambios',      placeholder: '¿Qué horario o cambio comunicas? ¿Desde cuándo aplica?' },
    { v: 'recordatorio', l: 'Recordatorio',            placeholder: '¿Qué quieres recordar a tu audiencia? ¿Hay fecha límite?' },
    { v: 'temporada',    l: 'Temporada / fecha',       placeholder: '¿Qué fecha o temporada especial es? ¿Cómo lo celebras?' },
    { v: 'faq',          l: 'FAQ / pregunta frecuente',placeholder: '¿Qué pregunta responderás? ¿Cuál es la respuesta?' },
  ],
  conectar: [
    { v: 'equipo',         l: 'Equipo / personas',    placeholder: 'Presenta a tu equipo. ¿Nombre, rol, algo curioso?' },
    { v: 'detras_camara',  l: 'Detrás de cámara',     placeholder: 'Muestra el día a día. ¿Qué momento quieres mostrar?' },
    { v: 'historia',       l: 'Historia / origen',    placeholder: '¿Qué historia quieres contar? ¿Cómo empezó tu negocio?' },
    { v: 'agradecimiento', l: 'Agradecimiento',       placeholder: '¿A quién agradeces? ¿Por qué? ¿Hay un hito detrás?' },
    { v: 'pregunta',       l: 'Pregunta a audiencia', placeholder: '¿Qué pregunta quieres lanzar a tu comunidad?' },
  ],
  ensenar: [
    { v: 'tips',        l: 'Tips / consejos',        placeholder: '¿Cuántos tips? ¿Sobre qué tema? ¿Qué problema resuelven?' },
    { v: 'tutorial',    l: 'Tutorial / paso a paso', placeholder: '¿Qué enseñas? ¿Cuántos pasos? ¿Qué resultado obtiene?' },
    { v: 'mito',        l: 'Mito o verdad',          placeholder: '¿Qué mito desmientes sobre tu sector?' },
    { v: 'comparativa', l: 'Comparativa',            placeholder: '¿Qué comparas? ¿Cuál es la diferencia clave?' },
    { v: 'dato',        l: 'Dato curioso',           placeholder: '¿Qué dato sorprendente quieres compartir?' },
  ],
  demostrar: [
    { v: 'testimonio',    l: 'Testimonio / reseña',  placeholder: 'Pega aquí la reseña o cuéntanos qué dijo el cliente.' },
    { v: 'antes_despues', l: 'Antes / después',      placeholder: '¿Qué tratamiento? ¿Cuánto tiempo entre ambas fotos?' },
    { v: 'caso_exito',    l: 'Caso de éxito',        placeholder: '¿Qué cliente? ¿Cuál era el problema y cuál el resultado?' },
    { v: 'ugc',           l: 'Contenido de clientes',placeholder: '¿Qué compartió el cliente? ¿Quieres mencionarlo?' },
  ],
};
