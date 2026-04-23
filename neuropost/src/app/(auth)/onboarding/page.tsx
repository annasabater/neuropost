'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { SocialSector, BrandTone, PublishMode, PostGoal, VisualStyle, Brand } from '@/types';
import { useTagInput } from '@/hooks/useTagInput';
import CouponInput from '@/components/billing/CouponInput';
import { getTemplateForSector } from '@/lib/industry-templates';

import LogoUpload from '@/components/onboarding/LogoUpload';

interface ContentCategoryDraft {
  category_key: string;
  name:         string;
  source:       'template' | 'user' | 'ai_suggested';
  active:       boolean;
}

// ─── Themed image helper ──────────────────────────────────────────────────────
// We use loremflickr, which returns a real Flickr photo matching one or more
// tags and honours a `?lock=N` seed for deterministic results. This replaces
// the previous opaque Unsplash IDs, where photos often didn't match the sector
// (e.g. "decoracion" showing pizzas). Thematic accuracy beats polish here.
const IMG = (keyword: string, seed: number, w = 400): string =>
  `https://loremflickr.com/${w}/${w}/${encodeURIComponent(keyword)}?lock=${seed}`;

// Primary English keyword per sector — drives every image on the onboarding.
const SECTOR_KEYWORD: Record<SocialSector, string> = {
  restaurante:      'restaurant,food',
  heladeria:        'ice-cream',
  cafeteria:        'coffee-shop',
  cocteleria:       'cocktail,bar',
  street_food:      'street-food',
  vinoteca:         'wine-bar',
  panaderia:        'bakery,bread',
  barberia:         'barbershop',
  nail_art:         'manicure',
  estetica:         'spa,wellness',
  maquillaje:       'makeup',
  boutique:         'fashion-boutique',
  moda_hombre:      'mens-fashion',
  zapateria:        'shoes',
  skincare:         'skincare',
  gym:              'gym,fitness',
  yoga:             'yoga',
  dental:           'dentist,teeth',
  clinica:          'clinic,medical',
  clinica_estetica: 'aesthetic-clinic',
  nutricion:        'healthy-food',
  decoracion:       'interior-design',
  jardineria:       'garden',
  reformas:         'renovation',
  inmobiliaria:     'real-estate',
  inmobiliaria_lujo:'luxury-home',
  fotografia:       'photography,camera',
  floristeria:      'flowers,bouquet',
  academia:         'classroom,study',
  abogado:          'law-office',
  veterinario:      'veterinary,pet',
  mecanica:         'car-workshop',
  teatro:           'theatre,stage',
  arte:             'art-gallery',
  libreria:         'bookstore',
  gaming:           'gaming,esports',
  viajes:           'travel,landscape',
  hotel:            'hotel',
  regalos:          'gift-shop',
  tecnologia:       'technology,gadgets',
  ecommerce:        'online-shopping',
  agencia_marketing:'marketing-agency',
  peluqueria:       'hair-salon',
  tattoo:           'tattoo-studio',
  psicologia:       'psychology,therapy',
  fisioterapia:     'physiotherapy',
  arquitectura:     'architecture',
  consultoria:      'business-consulting',
  // Turismo y alojamiento
  hostal:           'hostel',
  casa_rural:       'countryside-house',
  camping:          'camping,nature',
  agencia_viajes:   'travel-agency',
  // Cultura y ocio
  museo:            'museum',
  galeria:          'art-gallery',
  sala_conciertos:  'concert-hall,music',
  cine:             'cinema,movies',
  escape_room:      'escape-room,puzzle',
  // Educación y formación
  escuela:          'school,classroom',
  guarderia:        'kindergarten,children',
  academia_idiomas: 'language-school',
  academia_musica:  'music-school',
  academia_deporte: 'sports-academy',
  // Deporte y aventura
  centro_deportivo: 'sports-center',
  parque_acuatico:  'water-park',
  aventura:         'adventure,outdoor',
  club_deportivo:   'sports-club',
  padel:            'padel,tennis',
  // Ocio y familia
  centro_ludico:    'playground,fun',
  parque_infantil:  'playground,children',
  zoo:              'zoo,animals',
  acuario:          'aquarium,fish',
  // Eventos y servicios
  organizacion_eventos: 'event-planning',
  catering:         'catering,food-event',
  ong:              'volunteering,charity',
  coworking:        'coworking,office',
  otro:             'business,storefront',
};


// Three post images for the step 1 mock feed — themed to the selected sector.
function sectorPostsFor(sector: SocialSector): string[] {
  const kw = SECTOR_KEYWORD[sector];
  return [IMG(kw, 1, 500), IMG(kw, 2, 500), IMG(kw, 3, 500)];
}

// ─── Macro groups for step 1 ─────────────────────────────────────────────────

type PillItem = { label: string; sector: SocialSector };

type MacroGroup = {
  id: string;
  label: string;
  sub: string;
  defaultSector: SocialSector;
  pills: PillItem[];
};

const MACRO_GROUPS: MacroGroup[] = [
  {
    id: 'hosteleria', label: 'Hostelería',
    sub: 'Restaurantes · cafeterías · bares · panadería',
    defaultSector: 'restaurante',
    pills: [
      { label: 'Restaurante',           sector: 'restaurante'   },
      { label: 'Cafetería / Brunch',    sector: 'cafeteria'     },
      { label: 'Bar / Coctelería',      sector: 'cocteleria'    },
      { label: 'Panadería / Pastelería',sector: 'panaderia'     },
      { label: 'Street food',           sector: 'street_food'   },
      { label: 'Hotel',                 sector: 'hotel'         },
      { label: 'Agencia de viajes',     sector: 'agencia_viajes'},
    ],
  },
  {
    id: 'deporte', label: 'Deporte y bienestar',
    sub: 'Gimnasio · yoga · pilates · spa · estética',
    defaultSector: 'gym',
    pills: [
      { label: 'Gimnasio',         sector: 'gym'      },
      { label: 'Fitness boutique', sector: 'gym'      },
      { label: 'CrossFit',         sector: 'gym'      },
      { label: 'Yoga / Pilates',   sector: 'yoga'     },
      { label: 'Spa',              sector: 'estetica' },
      { label: 'Estética',         sector: 'estetica' },
      { label: 'Nutrición',        sector: 'nutricion'},
    ],
  },
  {
    id: 'salud', label: 'Salud',
    sub: 'Clínicas · dental · veterinaria · psicología',
    defaultSector: 'clinica',
    pills: [
      { label: 'Clínica',       sector: 'clinica'      },
      { label: 'Dental',        sector: 'dental'       },
      { label: 'Veterinaria',   sector: 'veterinario'  },
      { label: 'Psicología',    sector: 'psicologia'   },
      { label: 'Fisioterapia',  sector: 'fisioterapia' },
    ],
  },
  {
    id: 'servicios', label: 'Servicios profesionales',
    sub: 'Legal · inmobiliaria · talleres · asesoría',
    defaultSector: 'consultoria',
    pills: [
      { label: 'Abogado / Legal',      sector: 'abogado'      },
      { label: 'Inmobiliaria',         sector: 'inmobiliaria' },
      { label: 'Talleres / Mecánica',  sector: 'mecanica'     },
      { label: 'Consultoría',          sector: 'consultoria'  },
      { label: 'Arquitectura',         sector: 'arquitectura' },
    ],
  },
  {
    id: 'comercio', label: 'Comercio local',
    sub: 'Moda · floristería · barbería · retail',
    defaultSector: 'boutique',
    pills: [
      { label: 'Moda / Boutique', sector: 'boutique'    },
      { label: 'Peluquería',      sector: 'peluqueria'  },
      { label: 'Barbería',        sector: 'barberia'    },
      { label: 'Floristería',     sector: 'floristeria' },
      { label: 'Retail / Tienda', sector: 'ecommerce'   },
    ],
  },
  {
    id: 'creativos', label: 'Creativos y educación',
    sub: 'Fotografía · formación · cultura · eventos',
    defaultSector: 'fotografia',
    pills: [
      { label: 'Fotografía',           sector: 'fotografia'          },
      { label: 'Academia / Formación', sector: 'academia'            },
      { label: 'Centro infantil',      sector: 'guarderia'           },
      { label: 'Teatro / Cultura',     sector: 'teatro'              },
      { label: 'Eventos / Bodas',      sector: 'organizacion_eventos'},
      { label: 'Hogar / Deco',         sector: 'decoracion'          },
    ],
  },
];

function GroupIcon({ id, color }: { id: string; color: string }) {
  const p = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (id === 'hosteleria') return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M3 2v6a3 3 0 0 0 6 0V2"/><line x1="6" y1="11" x2="6" y2="22"/><line x1="18" y1="2" x2="18" y2="22"/><path d="M15 2v7h6V2"/>
    </svg>
  );
  if (id === 'deporte') return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/>
      <line x1="3" y1="7" x2="6" y2="7"/><line x1="3" y1="17" x2="6" y2="17"/>
      <line x1="18" y1="7" x2="21" y2="7"/><line x1="18" y1="17" x2="21" y2="17"/>
      <line x1="6" y1="12" x2="18" y2="12"/>
    </svg>
  );
  if (id === 'salud') return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
  if (id === 'servicios') return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <rect x="2" y="7" width="20" height="14"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  );
  if (id === 'comercio') return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...p}>
      <polyline points="22 10 12 2 2 10 12 18 22 10"/><path d="M6 12v5c0 2.21 2.69 4 6 4s6-1.79 6-4v-5"/>
    </svg>
  );
}

// ─── Visual style data ────────────────────────────────────────────────────────

const VISUAL_STYLES: {
  value: VisualStyle; title: string; palette: string[];
}[] = [
  { value: 'fresh',     title: 'Natural',      palette: ['#8DB88A','#C4A882','#EDE8DC','#4A6741'] },
  { value: 'elegant',   title: 'Minimalista',  palette: ['#F7E7E1','#E8C4B8','#D4A5A5','#C47E8A'] },
  { value: 'editorial', title: 'Editorial',    palette: ['#F8F6F2','#1A1A1A','#C0B090','#6B6B6B'] },
  { value: 'warm',      title: 'Clásico',      palette: ['#A0522D','#D2691E','#F5DEB3','#8B4513'] },
  { value: 'creative',  title: 'Creativo',     palette: ['#FF6B9D','#FF9500','#34C759','#007AFF'] },
  { value: 'dynamic',   title: 'Moody',        palette: ['#0D0D0D','#FF2D55','#1C1C1E','#00E5FF'] },
  { value: 'dark',      title: 'Luxury',       palette: ['#1A1A1A','#C9A84C','#2D2D2D','#F5F0E8'] },
  { value: 'vintage',   title: 'Vintage',      palette: ['#C4956A','#8B5E3C','#F2E8D9','#4A3728'] },
];

// ─── Deterministic placeholder images ────────────────────────────────────────
// picsum.photos returns real photos keyed by a string seed — always resolves,
// no keyword matching issues. Replace with Replicate-generated images later.

// Seed per style for deterministic loremflickr photos in step 2
const STYLE_SEED_NUM: Record<VisualStyle, number> = {
  fresh: 11, elegant: 22, editorial: 33, warm: 44,
  creative: 55, dynamic: 66, dark: 77, vintage: 88,
};

// Short aesthetic descriptors shown under each featured style card
const STYLE_DESCRIPTORS: Record<VisualStyle, string> = {
  fresh:     'Orgánico · Cálido · Auténtico',
  elegant:   'Limpio · Delicado · Sofisticado',
  editorial: 'Revista · Bold · Asimétrico',
  warm:      'Rústico · Artesanal · Cercano',
  creative:  'Vibrante · Energía · Impacto',
  dynamic:   'Dramático · Intenso · Nocturno',
  dark:      'Premium · Exclusivo · Refinado',
  vintage:   'Retro · Nostálgico · Cálido',
};

// 3 recommended styles per macro group
const STYLE_RECOMMENDATIONS: Record<string, VisualStyle[]> = {
  hosteleria: ['fresh', 'warm', 'editorial'],
  deporte:    ['dynamic', 'creative', 'editorial'],
  salud:      ['fresh', 'elegant', 'editorial'],
  servicios:  ['editorial', 'dark', 'elegant'],
  comercio:   ['fresh', 'creative', 'dynamic'],
  creativos:  ['editorial', 'creative', 'vintage'],
};

// Sector-themed photos via loremflickr with deterministic seeds.
// Each style gets a unique seed so every card shows a different shot.
function getFeaturedPhoto(style: VisualStyle, sector: SocialSector): string {
  const kw = SECTOR_KEYWORD[sector];
  return `https://loremflickr.com/600/340/${encodeURIComponent(kw)}?lock=${STYLE_SEED_NUM[style]}`;
}
function getThumbnailPhoto(style: VisualStyle, sector: SocialSector): string {
  const kw = SECTOR_KEYWORD[sector];
  return `https://loremflickr.com/240/140/${encodeURIComponent(kw)}?lock=${STYLE_SEED_NUM[style] + 100}`;
}

function getSectorPreviewImages(sector: SocialSector, style: VisualStyle): string[] {
  return [10,11,12,13,14,15,16,17,18].map((i) =>
    `https://picsum.photos/seed/${style}-${sector}-${i}/500/500`,
  );
}



function getDynamicQuestions(sector: SocialSector): { label: string; placeholder: string; key: string }[] {
  const map: Partial<Record<SocialSector, { label: string; placeholder: string; key: string }[]>> = {
    heladeria:   [{ label: 'Producto estrella',      placeholder: 'Ej: helado de pistacho artesanal', key: 'star_product' }],
    restaurante: [{ label: 'Tipo de cocina',          placeholder: 'Ej: italiana, mediterránea',       key: 'cuisine' }],
    cafeteria:   [{ label: 'Especialidad',             placeholder: 'Ej: specialty coffee, brunch',     key: 'specialty' }],
    gym:         [{ label: 'Tipo de entrenamiento',   placeholder: 'Ej: CrossFit, funcional, yoga',     key: 'training' }],
    clinica:     [{ label: 'Especialidad médica',     placeholder: 'Ej: estética, dental',              key: 'specialty' }],
    barberia:    [{ label: 'Servicios destacados',    placeholder: 'Ej: corte clásico, barba',          key: 'services' }],
    boutique:    [{ label: 'Tipo de moda',            placeholder: 'Ej: casual, formal, boho',          key: 'fashion_type' }],
    inmobiliaria:[{ label: 'Zonas de operación',      placeholder: 'Ej: Barcelona centro',              key: 'zones' }],
    yoga:        [{ label: 'Tipos de clases',         placeholder: 'Ej: hatha, vinyasa, meditación',    key: 'classes' }],
  };
  return map[sector] ?? [{ label: 'Tu producto o servicio estrella', placeholder: 'Lo más popular de tu negocio', key: 'star_product' }];
}

// ─── Step 3 select options ────────────────────────────────────────────────────

const SECTOR_SERVICE_OPTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante: ['Cocina italiana', 'Cocina mediterránea', 'Cocina española', 'Cocina japonesa', 'Cocina mexicana', 'Cocina fusión', 'Hamburguesas artesanales', 'Tapas y raciones', 'Menú degustación'],
  heladeria:   ['Helados artesanales', 'Helados italianos', 'Frozen yogurt', 'Granizados', 'Helados veganos', 'Tartas heladas'],
  cafeteria:   ['Specialty coffee', 'Brunch y desayunos', 'Café de especialidad', 'Bollería artesanal', 'Té e infusiones'],
  cocteleria:  ['Cócteles creativos', 'Cócteles clásicos', 'Destilados premium', 'Vermut y aperitivo', 'Vinos naturales'],
  street_food: ['Burgers gourmet', 'Comida asiática', 'Burritos y tacos', 'Hot dogs artesanales', 'Comida vegana', 'Bocatas y sandwiches'],
  vinoteca:    ['Vinos nacionales', 'Vinos importados', 'Vinos naturales', 'Catas de vino', 'Maridajes y tapas'],
  panaderia:   ['Pan artesanal', 'Bollería francesa', 'Pastelería', 'Pan de masa madre', 'Pasteles personalizados'],
  barberia:    ['Corte clásico', 'Degradado y fade', 'Arreglo de barba', 'Afeitado con navaja', 'Tratamientos capilares'],
  nail_art:    ['Nail art creativo', 'Manicura clásica', 'Pedicura', 'Uñas de gel', 'Uñas acrílicas'],
  estetica:    ['Tratamientos faciales', 'Depilación láser', 'Masajes relajantes', 'Spa & wellness', 'Tratamientos corporales'],
  maquillaje:  ['Maquillaje de novia', 'Maquillaje artístico', 'Cursos de maquillaje', 'Productos de cosmética'],
  boutique:    ['Moda mujer casual', 'Moda mujer formal', 'Moda boho', 'Accesorios y complementos', 'Ropa de diseño'],
  moda_hombre: ['Ropa casual', 'Trajes y formal', 'Streetwear', 'Accesorios de moda'],
  zapateria:   ['Calzado sport', 'Calzado formal', 'Zapatillas de tendencia', 'Calzado de temporada'],
  skincare:    ['Cosmética natural', 'Antiaging', 'Rutina coreana', 'Cremas y serums', 'Tratamientos de acné'],
  gym:         ['CrossFit', 'Musculación y fitness', 'Functional training', 'HIIT', 'Entrenamiento personal', 'Boxeo / Artes marciales'],
  yoga:        ['Hatha yoga', 'Vinyasa flow', 'Pilates mat', 'Meditación', 'Yoga prenatal', 'Yoga restaurativo'],
  dental:      ['Ortodoncia invisible', 'Implantes dentales', 'Estética dental', 'Blanqueamiento dental', 'Odontología general'],
  clinica:     ['Medicina estética', 'Fisioterapia', 'Nutrición y dietética', 'Psicología', 'Medicina general'],
  nutricion:   ['Nutrición deportiva', 'Pérdida de peso', 'Nutrición clínica', 'Dietas veganas', 'Planes personalizados'],
  decoracion:  ['Decoración nórdica', 'Interiorismo', 'Muebles a medida', 'Home staging', 'Decoración industrial'],
  jardineria:  ['Jardines residenciales', 'Mantenimiento de jardines', 'Paisajismo', 'Plantas y flores'],
  reformas:    ['Reformas integrales', 'Reforma de baño', 'Reforma de cocina', 'Pintura y acabados'],
  inmobiliaria:['Pisos de lujo', 'Locales comerciales', 'Vivienda primera compra', 'Alquiler residencial', 'Obra nueva'],
  fotografia:  ['Fotografía de bodas', 'Retrato profesional', 'Fotografía de producto', 'Fotografía de eventos'],
  floristeria: ['Ramos de novia', 'Flores naturales', 'Plantas de interior', 'Arreglos florales', 'Flores secas'],
};


// ─── Step 4 keyword suggestions ───────────────────────────────────────────────

const SECTOR_KEYWORD_SUGGESTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante: ['artesanal', 'fresco', 'temporada', 'local', 'gourmet', 'casero', 'orgánico', 'sin gluten', 'km0'],
  heladeria:   ['artesanal', 'cremoso', 'natural', 'sin lactosa', 'vegano', 'casero', 'fruta fresca'],
  cafeteria:   ['specialty coffee', 'brunch', 'acogedor', 'artesanal', 'sostenible', 'orgánico', 'tercera ola'],
  gym:         ['fuerza', 'cardio', 'resultados', 'constancia', 'motivación', 'salud', 'bienestar', 'comunidad'],
  yoga:        ['bienestar', 'equilibrio', 'mindfulness', 'meditación', 'flexibilidad', 'paz interior'],
  barberia:    ['clásico', 'grooming', 'artesanal', 'fade', 'barba', 'estilo', 'profesional'],
  boutique:    ['tendencia', 'exclusivo', 'estilo', 'colección', 'temporada', 'moda sostenible'],
  inmobiliaria:['vivienda', 'inversión', 'calidad', 'confort', 'exclusivo', 'oportunidad'],
  floristeria: ['natural', 'flores frescas', 'artesanal', 'romántico', 'regalo', 'sostenible'],
  dental:      ['salud dental', 'sonrisa perfecta', 'confianza', 'bienestar', 'estética dental'],
  panaderia:   ['artesanal', 'masa madre', 'natural', 'tradicional', 'fresco', 'sin conservantes'],
  skincare:    ['natural', 'orgánico', 'hidratación', 'antiaging', 'luminosidad', 'cruelty-free'],
  fotografia:  ['storytelling', 'luz natural', 'editorial', 'autenticidad', 'momentos únicos'],
  decoracion:  ['hogar', 'diseño', 'estilo', 'exclusivo', 'personalizado', 'inspiración'],
};

// ─── Shared design tokens ─────────────────────────────────────────────────────

const ACCENT = '#0F766E';
const BG_L   = '#eeeef0';
const BG_R   = '#f5f5f7';
const INK    = '#111827';
const MUTED  = '#6b7280';
const BORDER = '#d4d4d8';
const FONT   = "var(--font-barlow), 'Barlow', sans-serif";
const FONT_C = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px',
  background: '#ffffff',
  border: `1px solid ${BORDER}`,
  borderRadius: 0, color: INK,
  fontFamily: FONT,
  fontSize: '0.9rem', outline: 'none',
  transition: 'border-color 0.15s',
};


// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: FONT }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', color: INK, letterSpacing: '0.01em', textTransform: 'uppercase', marginBottom: 6, lineHeight: 1.0 }}>
      {children}
    </div>
  );
}

function StepSub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function BtnPrimary({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 28px', borderRadius: 0,
      background: disabled ? '#e5e7eb' : INK,
      color: disabled ? '#9ca3af' : '#ffffff', border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: FONT_C, fontWeight: 700, fontSize: 13,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

function PillOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px',
        cursor: 'pointer',
        fontFamily: FONT,
        fontSize: '0.82rem',
        fontWeight: 700,
        border: `1.5px solid ${active ? ACCENT : BORDER}`,
        background: active ? ACCENT : '#ffffff',
        color: active ? '#ffffff' : '#374151',
        transition: 'all 0.15s',
        outline: 'none',
        borderRadius: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}


function BtnBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 20px', borderRadius: 0,
      background: '#ffffff', border: `1px solid ${BORDER}`,
      color: MUTED, cursor: 'pointer',
      fontFamily: FONT, fontWeight: 600, fontSize: 13,
      transition: 'all 0.15s',
    }}>
      ← Atrás
    </button>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

type PlanId = 'starter' | 'pro' | 'total';

// Weekly post frequency is determined by the selected plan (decided at the
// payment step); the backend still expects publish_frequency, so we derive it.
const FREQUENCY_BY_PLAN: Record<PlanId, 2 | 5 | 7> = {
  starter: 2,
  pro: 5,
  total: 7,
};

const ONBOARDING_PLANS: {
  id: PlanId;
  name: string;
  price: number;
  desc: string;
  features: string[];
  featured?: boolean;
  badge?: string;
}[] = [
  {
    id:       'starter',
    name:     'Starter',
    price:     62,
    desc:     'Para presencia activa',
    features: [
      '📷  2 fotos/semana · 🎬  Carruseles hasta 3 · Sin vídeo/reel',
      'Publicación programada',
      'Calendario avanzado',
      'Edición de contenido',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte por email',
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:     109,
    desc:     'Máximo alcance',
    featured: true,
    badge:    'Más popular',
    features: [
      '📷  4 fotos/semana · 🎬  2 vídeo/reel ≤90s · ⭐  Carruseles hasta 8',
      'Publicación programada',
      'Ideas basadas en tendencias y tu contenido',
      'Mejores horas para publicar',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte prioritario',
    ],
  },
  {
    id:    'total',
    name:  'Total',
    price:  189,
    desc:  'Control completo',
    badge: 'Completo',
    features: [
      '📷  Hasta 7 fotos/semana · 🎬  10 vídeo/reel ≤90s · ⭐  Carruseles hasta 20',
      'Publicación programada',
      'Ideas basadas en tendencias y tu contenido',
      'Mejores horas para publicar',
      'Solicitudes personalizadas',
      'Análisis de rendimiento',
      'IA integrada',
      'Soporte 24h',
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRedo = searchParams.get('redo') === '1';
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();
  const [step,   setStep]   = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // User personal info
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  const [sector,           setSector]           = useState<SocialSector>('restaurante');
  const [customSectorLabel, setCustomSectorLabel] = useState('');
  const [secondarySectors, setSecondarySectors] = useState<SocialSector[]>([]);
  const [visualStyle,      setVisualStyle]      = useState<VisualStyle>('warm');
  const [name,             setName]             = useState('');
  const [location,         setLocation]         = useState('');
  const [slogan,           setSlogan]           = useState('');
  // Each dynamic question can have multiple selected values (e.g. several
  // star products for a restaurant). The last entry is reserved for free-text
  // "otro" input and persisted together with the pill selections.
  const [dynamicAnswers,   setDynamicAnswers]   = useState<Record<string, string[]>>({});
  const [tone,             setTone]             = useState<BrandTone>('cercano');
  const [keywords,         setKeywords]         = useState<string[]>([]);
  const [kwInput,          setKwInput]          = useState('');
  const [forbidden,        setForbidden]        = useState<string[]>([]);
  const [fbInput,          setFbInput]          = useState('');
  const [objective]                             = useState<PostGoal>('engagement');
  const [publishMode,      setPublishMode]      = useState<PublishMode>('semi');
  const country = 'España';
  const INITIAL_PRIMARY_COLOR = '#0F766E';
  const INITIAL_SECONDARY_COLOR = '#374151';
  const INITIAL_TERTIARY_COLOR = '#94A3B8';
  const [primaryColor,     setPrimaryColor]     = useState(INITIAL_PRIMARY_COLOR);
  const [secondaryColor,   setSecondaryColor]   = useState(INITIAL_SECONDARY_COLOR);
  const [tertiaryColor,    setTertiaryColor]    = useState(INITIAL_TERTIARY_COLOR);
  const [hasCustomPalette, setHasCustomPalette] = useState(true);
  const [promoCodeId,      setPromoCodeId]      = useState<string | null>(null);
  const [discountText,     setDiscountText]     = useState('');
  const [selectedPlan,     setSelectedPlan]     = useState<PlanId>('pro');
  const [selectedGroup,    setSelectedGroup]    = useState<string | null>(null);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [activePillLabel,  setActivePillLabel]  = useState('');
  const [realismLevel,     setRealismLevel]     = useState(70);
  const [logoUrl,          setLogoUrl]          = useState('');
  const [extractedColors,  setExtractedColors]  = useState<string[]>([]);
  const [specialties,      setSpecialties]      = useState<string[]>([]);
  const [language,         setLanguage]         = useState<'castellano' | 'catalan' | 'bilingual'>('castellano');
  const [emojiUse,         setEmojiUse]         = useState<'none' | 'moderate' | 'free'>('moderate');

  // ── Content categories ────────────────────────────────────────────────────────
  const [contentCategories, setContentCategories] = useState<ContentCategoryDraft[]>([]);

  // Snapshot of the persisted brand + auth metadata taken at redo-hydration
  // time. Comparisons (noEmojis recompute, firstName/lastName changed) read
  // from this ref — never from live form state, to avoid biting our tail
  // once the user interacts with the form.
  const redoSnapshotRef = useRef<{ brand: Brand; firstName: string; lastName: string } | null>(null);

  // Load template categories when sector changes
  // Prefill from existing brand when redoing onboarding
  useEffect(() => {
    if (!isRedo) return;
    void (async () => {
      try {
        const [brandJson, catsJson, userRes] = await Promise.all([
          fetch('/api/brands').then(r => r.json()),
          fetch('/api/brands/categories').then(r => r.json()),
          createBrowserClient().auth.getUser(),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const brand = (brandJson?.brand ?? null) as any;
        if (!brand) return;
        const categories = Array.isArray(catsJson?.categories) ? catsJson.categories : [];
        const meta = (userRes.data.user?.user_metadata ?? {}) as Record<string, unknown>;
        const initialFirstName = typeof meta.first_name === 'string' ? meta.first_name : '';
        const initialLastName  = typeof meta.last_name  === 'string' ? meta.last_name  : '';

        if (brand.name)         setName(brand.name);
        if (brand.sector) {
          setSector(brand.sector as SocialSector);
          const g = MACRO_GROUPS.find((g) => g.pills.some((p) => p.sector === brand.sector) || g.defaultSector === brand.sector);
          if (g) { setSelectedGroup(g.id); const p = g.pills.find((p) => p.sector === brand.sector); if (p) setActivePillLabel(p.label); }
        }
        if (brand.secondary_sectors?.length) setSecondarySectors(brand.secondary_sectors);
        if (brand.visual_style) setVisualStyle(brand.visual_style as VisualStyle);
        if (brand.tone)         setTone(brand.tone as BrandTone);
        if (brand.hashtags?.length) setKeywords(brand.hashtags);
        if (brand.location)     setLocation(brand.location);
        if (brand.logo_url)     setLogoUrl(brand.logo_url);
        if (brand.rules?.dynamicAnswers?.specialty) setSpecialties(brand.rules.dynamicAnswers.specialty);
        if (brand.publish_mode) setPublishMode(brand.publish_mode as PublishMode);
        if (brand.slogans?.[0]) setSlogan(brand.slogans[0]);
        if (brand.colors?.primary)   setPrimaryColor(brand.colors.primary);
        if (brand.colors?.secondary) setSecondaryColor(brand.colors.secondary);
        if (brand.colors?.tertiary)  setTertiaryColor(brand.colors.tertiary);
        if (brand.colors?.primary || brand.colors?.secondary) setHasCustomPalette(true);
        if (brand.rules?.forbiddenWords?.length) setForbidden(brand.rules.forbiddenWords);
        if (brand.rules?.dynamicAnswers) setDynamicAnswers(brand.rules.dynamicAnswers);
        setFirstName(initialFirstName);
        setLastName(initialLastName);
        if (categories.length) {
          setContentCategories(categories.map((c: ContentCategoryDraft) => ({
            category_key: c.category_key,
            name:         c.name,
            source:       c.source,
            active:       c.active,
          })));
        }

        redoSnapshotRef.current = { brand: brand as Brand, firstName: initialFirstName, lastName: initialLastName };
      } catch {
        /* best-effort prefill — silent */
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRedo]);

  useEffect(() => {
    // In redo mode respect persisted categories — don't clobber with template.
    if (isRedo) return;
    const template = getTemplateForSector(sector);
    if (template) {
      setContentCategories(
        template.default_categories.map((c) => ({
          category_key: c.key,
          name:         c.name,
          source:       'template' as const,
          active:       true,
        })),
      );
    } else {
      setContentCategories([]);
    }
  }, [sector, isRedo]);


  const dynamicQuestions = getDynamicQuestions(sector);

  async function handleSubmit() {
    if (!name.trim()) { toast.error('El nombre del negocio es obligatorio'); return; }
    setSaving(true);
    try {
      // Save user name to Supabase auth metadata.
      // In redo we skip the round-trip unless the user actually changed the
      // names — comparison is against the snapshot taken at hydration time,
      // never against live form state.
      const snap = redoSnapshotRef.current;
      const authShouldUpdate = isRedo
        ? (snap !== null && (firstName.trim() !== snap.firstName || lastName.trim() !== snap.lastName))
        : (firstName.trim().length > 0 || lastName.trim().length > 0);
      if (authShouldUpdate) {
        const supabase = createBrowserClient();
        await supabase.auth.updateUser({
          data: {
            first_name: firstName.trim() || null,
            last_name:  lastName.trim()  || null,
            show_name:  true,
          },
        });
      }
      const effectivePrimaryColor = hasCustomPalette ? primaryColor : INITIAL_PRIMARY_COLOR;
      const effectiveSecondaryColor = hasCustomPalette ? secondaryColor : INITIAL_SECONDARY_COLOR;
      const effectiveTertiaryColor = hasCustomPalette ? tertiaryColor : INITIAL_TERTIARY_COLOR;
      const extraContext = dynamicQuestions
        .map((q) => {
          const values = (dynamicAnswers[q.key] ?? []).filter(v => v && v.trim() !== '');
          return values.length ? `${q.label}: ${values.join(', ')}` : '';
        })
        .filter(Boolean).join('. ');
      const styleInstructions: Record<VisualStyle, string> = {
        fresh:     'Estilo natural y wellness: tono orgánico, luz natural, referencias a bienestar y naturaleza.',
        dark:      'Estilo lujo y premium: copywriting exclusivo, sin exclamaciones ni emojis, muy sofisticado.',
        vintage:   'Estilo retro y vintage: lenguaje nostálgico y artesanal, valorando el oficio y la tradición.',
        warm:      'Estilo rústico y artesanal: tono cercano, producto local, texturas y materiales naturales.',
        dynamic:   'Estilo urbano y street: frases cortas, imperativas, alto impacto visual y energía urbana.',
        elegant:   'Estilo soft y pastel: tono delicado y femenino, sensaciones suaves, estética cuidada.',
        editorial: 'Estilo editorial y fashion: storytelling visual puro, sin emojis, composición asimétrica.',
        creative:  'Estilo playful e ilustrativo: usa emojis, exclamaciones, colores primarios y mucha energía.',
      };
      // Build rules: preserve subfields the onboarding doesn't expose; recompute
      // noEmojis only if visual_style actually changed vs the snapshot.

      const originalRules = snap?.brand?.rules ?? null;
      const visualStyleChanged = isRedo && snap ? visualStyle !== snap.brand.visual_style : true;
      // Collect dynamic answers from form state, dropping empty entries.
      // Written explicitly in both branches so the form state is always the
      // source of truth (hydrated from BD in redo, so a no-op if unchanged).
      const filteredDynamicAnswers: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(dynamicAnswers)) {
        const cleaned = values.filter(v => v && v.trim() !== '');
        if (cleaned.length) filteredDynamicAnswers[key] = cleaned;
      }
      const specialtyAnswers = specialties.length > 0 ? { ...filteredDynamicAnswers, specialty: specialties } : filteredDynamicAnswers;
      const computedNoEmojis2 = emojiUse === 'none';
      const rulesPayload = isRedo && originalRules
        ? {
            ...originalRules,
            forbiddenWords: forbidden,
            noEmojis:       computedNoEmojis2,
            language,
            emojiUse,
            dynamicAnswers: specialtyAnswers,
          }
        : {
            forbiddenWords:      forbidden,
            noPublishDays:       [],
            noEmojis:            computedNoEmojis2,
            noAutoReplyNegative: false,
            forbiddenTopics:     [],
            language,
            emojiUse,
            dynamicAnswers:      specialtyAnswers,
          };
      const baseBody = {
        name, sector, secondary_sectors: secondarySectors,
        visual_style: visualStyle, tone, hashtags: keywords,
        location: location.trim() || null,
        logo_url: logoUrl || undefined,
        slogans: slogan ? [slogan] : [],
        publish_mode: publishMode,
        colors: { primary: effectivePrimaryColor, secondary: effectiveSecondaryColor, tertiary: effectiveTertiaryColor, accent: effectivePrimaryColor },
        rules: rulesPayload,
        brand_voice_doc: [
          `Negocio: ${name}. Sector: ${MACRO_GROUPS.find((g) => g.id === selectedGroup)?.label ?? sector}${customSectorLabel.trim() ? ` (${customSectorLabel.trim()})` : ''}.`,
          `Estilo visual: ${visualStyle}. ${styleInstructions[visualStyle]}`,
          `Realismo visual: ${realismLevel}%.`,
          specialties.length > 0 ? `Especialidades: ${specialties.join(', ')}.` : '',
          `Tono de marca: ${tone}. Idioma: ${language}. Emojis: ${emojiUse}.`,
          extraContext,
          keywords.length > 0 ? `Palabras clave: ${keywords.join(', ')}.` : '',
          `Objetivo principal: ${objective}.`,
          location ? `Ubicación: ${location}.` : '',
        ].filter(Boolean).join(' '),
      };
      // PATCH body in redo: drop fields the endpoint can't update as columns
      // (content_categories, publish_frequency, promo_code_id) and plan.
      const body = isRedo
        ? baseBody
        : {
            ...baseBody,
            publish_frequency: FREQUENCY_BY_PLAN[selectedPlan],
            plan: selectedPlan,
            promo_code_id: promoCodeId ?? undefined,
            content_categories: contentCategories.filter((c) => c.active),
          };
      const res = await fetch('/api/brands', {
        method: isRedo ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? (isRedo ? 'Error al actualizar el negocio' : 'Error al crear el negocio'));
      toast.success(isRedo ? '¡Marca actualizada correctamente!' : '¡Negocio configurado correctamente!');
      if (isRedo) {
        toast('Recuerda: puedes afinar productos, FAQs y competidores cuando los editores estén disponibles en tu panel.', { duration: 6000 });
      }
      router.push(isRedo ? '/brand' : '/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally { setSaving(false); }
  }

  const previewPosts = sectorPostsFor(sector);
  const selectedStyle   = VISUAL_STYLES.find((s) => s.value === visualStyle)!;
  const effectivePrimaryColor = hasCustomPalette ? primaryColor : INITIAL_PRIMARY_COLOR;
  const effectiveSecondaryColor = hasCustomPalette ? secondaryColor : INITIAL_SECONDARY_COLOR;
  const effectiveTertiaryColor = hasCustomPalette ? tertiaryColor : INITIAL_TERTIARY_COLOR;
  // Right-column preview for step 2 — 9 photos specific to the current
  // (sector, style) pair, so switching style actually changes the images.
  const step2PreviewImgs = getSectorPreviewImages(sector, visualStyle);

  // ─── Right column previews ─────────────────────────────────────────────────

  const rightStep1 = (
    <div style={{ padding: '48px 40px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.1rem', color: INK, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
        Estética visual
      </div>
      <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: MUTED, marginBottom: 20, lineHeight: 1.4 }}>
        ¿Cómo quieres que se vea tu feed?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {VISUAL_STYLES.map((style) => {
          const selected = visualStyle === style.value;
          return (
            <button
              key={style.value}
              type="button"
              onClick={() => setVisualStyle(style.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                border: `2px solid ${selected ? INK : '#e5e7eb'}`,
                background: selected ? INK : '#fff',
                cursor: 'pointer', outline: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {/* Palette swatches */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {style.palette.map((c, i) => (
                  <div key={i} style={{ width: 18, height: 40, background: c }} />
                ))}
              </div>
              {/* Text */}
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '0.95rem', color: selected ? '#fff' : INK, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {style.title}
                </div>
              </div>
              {selected && (
                <div style={{ width: 18, height: 18, border: '2px solid #fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', fontWeight: 900, flexShrink: 0 }}>✓</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const rightStep2 = (
    <div style={{ padding: '48px 40px', height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 16 }}>
        Preview de tu feed
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, overflow: 'hidden' }}>
        {step2PreviewImgs.map((img: string, i: number) => (
          <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', background: '#f3f4f6' }} />
        ))}
      </div>
    </div>
  );

  const rightStep3 = (() => {
    // Current specialty from the sector-specific dynamic question.
    const specialty = Object.values(dynamicAnswers)
      .flat()
      .find((v) => v && v.trim() !== '') ?? '';
    // Location line combines region + country when available.
    const locationLine = location
      ? `${location}, ${country}`
      : country;
    // If the user has no custom palette, use the style palette as fallback.
    const primary = effectivePrimaryColor || ACCENT;
    const secondary = effectiveSecondaryColor || '#374151';
    const tertiary = effectiveTertiaryColor || secondary;

    return (
      <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 18, height: '100%', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
          Tu tarjeta de negocio
        </div>

        {/* Business card header */}
        <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, position: 'relative' }}>
          {/* Color bar at the top — visualises the two brand colors */}
          <div style={{ display: 'flex', height: 6 }}>
            <div style={{ flex: 2, background: primary }} />
            <div style={{ flex: 1, background: secondary }} />
            <div style={{ flex: 1, background: tertiary }} />
          </div>
          <div style={{ padding: '24px 28px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 58, height: 58, background: primary, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT_C, fontWeight: 900, fontSize: 26, color: '#ffffff',
              letterSpacing: '-0.02em',
            }}>
              {name ? name[0].toUpperCase() : 'N'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.45rem', color: INK, letterSpacing: '-0.02em', lineHeight: 1.1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name || 'Tu negocio'}
              </div>
              {specialty && (
                <div style={{ fontFamily: FONT, fontSize: '0.82rem', color: INK, marginTop: 4, fontWeight: 600 }}>
                  {specialty}
                </div>
              )}
              <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: tertiary }} />
                {locationLine}
              </div>
            </div>
          </div>
        </div>

        {/* Mini feed preview — 3×3 grid of sector + style photos */}
        <div>
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 8 }}>
            Vista previa del feed
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, border: `1px solid ${BORDER}` }}>
            {step2PreviewImgs.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  display: 'block',
                  background: '#f3f4f6',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  })();

  const SECTOR_TONE_MAP: Partial<Record<SocialSector, Record<BrandTone, string>>> = {
    heladeria: {
      cercano:     '¡Buenos días! ☀️ Ya tenemos los helados del día listos. ¿Cuál te apetece hoy?',
      profesional: 'Nuestra heladería artesanal presenta los nuevos sabores de temporada. Ingredientes selectos.',
      divertido:   '¿Calor? ¡Nosotros tenemos la solución! 🍦 Prueba nuestro nuevo helado de mango 🥭🔥',
      premium:     'Cada helado, una experiencia. Ingredientes selectos, elaboración artesanal, sabores que conquistan.',
    },
    restaurante: {
      cercano:     '¡Hola! 👋 Hoy tenemos un menú del día increíble. ¿Te vienes a probarlo?',
      profesional: 'Le invitamos a descubrir nuestra propuesta gastronómica de temporada. Reservas abiertas.',
      divertido:   '¿Quién dijo que los lunes no se come bien? 🍕 ¡Plato del día a precio de risa! 😋',
      premium:     'Donde cada plato cuenta una historia. Cocina de autor con productos de proximidad.',
    },
    cafeteria: {
      cercano:     '☕ Buenos días. Tu café favorito te espera. ¡Arrancamos la semana con energía!',
      profesional: 'Café de especialidad tostado artesanalmente. Descubra nuestras nuevas variedades de origen.',
      divertido:   'Café + croissant + domingo = Plan perfecto ☕🥐 ¿Vienes a brunchear? 🎉',
      premium:     'Cada taza, un ritual. Seleccionamos los mejores granos para una experiencia única.',
    },
    gym: {
      cercano:     '💪 ¡Buenos días equipo! Clase de las 7am lista. ¿Te apuntas hoy?',
      profesional: 'Nuevo programa de entrenamiento personalizado. Resultados garantizados con nuestros profesionales.',
      divertido:   '¡Hoy toca piernas y NADIE falta! 🦵🔥 El dolor es temporal, la gloria es para siempre 😂💪',
      premium:     'Tu mejor versión comienza aquí. Entrenamiento de élite con tecnología de vanguardia.',
    },
    barberia: {
      cercano:     '✂️ ¿Necesitas un cambio? Pásate y te dejamos como nuevo. ¡Reserva tu cita!',
      profesional: 'Ofrecemos una experiencia de grooming completa. Reserve su cita para nuestro servicio premium.',
      divertido:   'Nuevo look, nueva actitud 💈 ¡Ven a que te hagamos el fade más clean del barrio! 🔥',
      premium:     'El arte del grooming clásico. Donde la tradición y el estilo se encuentran.',
    },
    boutique: {
      cercano:     '🛍️ ¡Ya llegó la nueva colección! Ven a verla antes de que vuele. Te va a encantar.',
      profesional: 'Presentamos nuestra colección otoño-invierno. Piezas exclusivas para una mujer con estilo.',
      divertido:   '¡NUEVA COLE! 😍 Esto es lo que necesita tu armario esta temporada 👗✨',
      premium:     'Piezas seleccionadas con criterio. Moda que trasciende temporadas, estilo que perdura.',
    },
    inmobiliaria: {
      cercano:     '🏠 ¿Buscas tu nuevo hogar? Tenemos propiedades increíbles. ¡Cuéntanos qué necesitas!',
      profesional: 'Exclusiva selección de inmuebles. Asesoramiento personalizado para su próxima inversión.',
      divertido:   '¿Y si tu piso soñado estuviera más cerca de lo que crees? 🏡 ¡Ven a verlo! 😱',
      premium:     'Propiedades excepcionales para quienes buscan lo extraordinario. Exclusividad y ubicación.',
    },
    floristeria: {
      cercano:     '🌸 ¡Buenos días! Hoy tenemos ramos preciosos recién llegados. ¿Para quién es?',
      profesional: 'Composiciones florales artesanales para cada ocasión. Encargue su ramo personalizado.',
      divertido:   '¡Las flores hacen magia! 🌺✨ ¿A quién le alegrarías el día con un ramo? 💐',
      premium:     'Arte floral de autor. Cada composición, una obra efímera de belleza natural.',
    },
    yoga: {
      cercano:     '🧘 Respira profundo. La clase de esta tarde es especial. ¿Te vienes?',
      profesional: 'Descubre nuestros programas de bienestar integral. Yoga, meditación y mindfulness.',
      divertido:   '¡Tu cuerpo te pide un buen estiramiento! 🧘‍♀️ Ven a fluir con nosotros 🌊✨',
      premium:     'Un espacio donde el cuerpo y la mente se reencuentran. Bienestar sin prisas.',
    },
    estetica: {
      cercano:     '💆 ¿Necesitas un momento para ti? Reserva tu sesión y desconecta del mundo.',
      profesional: 'Tratamientos faciales y corporales con tecnología de última generación. Resultados visibles.',
      divertido:   '¡Selfcare no es un lujo, es una necesidad! 🧖‍♀️ Ven a mimarte ✨',
      premium:     'Donde la ciencia y el bienestar se fusionan. Tratamientos exclusivos para pieles exigentes.',
    },
    dental: {
      cercano:     '😁 ¡Tu sonrisa merece brillar! Pide cita y te asesoramos sin compromiso.',
      profesional: 'Tratamientos de odontología avanzada con los mejores profesionales. Tu salud dental, nuestra prioridad.',
      divertido:   '¡Sonríe sin complejos! 😬➡️😁 Ven a conocer nuestro blanqueamiento express ✨',
      premium:     'La excelencia en estética dental. Sonrisas perfectas con la tecnología más avanzada.',
    },
    nutricion: {
      cercano:     '🥗 ¿Quieres comer mejor? Te ayudamos con un plan a tu medida. ¡Escríbenos!',
      profesional: 'Planes nutricionales basados en evidencia científica. Consulta personalizada con nuestro equipo.',
      divertido:   '¡Comer sano no tiene que ser aburrido! 🥑🎉 Mira estas recetas fáciles y riquísimas',
      premium:     'Nutrición de precisión. Planes exclusivos diseñados para tu estilo de vida.',
    },
    decoracion: {
      cercano:     '🏡 ¡Transforma tu hogar! Te ayudamos a crear el espacio que siempre soñaste.',
      profesional: 'Proyectos de interiorismo a medida. Diseño funcional y estético para cada espacio.',
      divertido:   '¡Tu salón necesita un glow up! 🛋️✨ Mira esta transformación antes/después 😱',
      premium:     'Espacios que inspiran. Diseño interior exclusivo donde cada detalle tiene un propósito.',
    },
    fotografia: {
      cercano:     '📸 ¿Quieres inmortalizar un momento especial? ¡Hablemos de tu sesión!',
      profesional: 'Fotografía profesional de producto, corporativa y eventos. Resultados que comunican.',
      divertido:   '¡Di patata! 📸🧀 Sesiones divertidas, fotos que molan. ¿Cuándo hacemos la tuya?',
      premium:     'Cada imagen cuenta una historia. Fotografía de autor que captura la esencia.',
    },
  };
  const defaultToneExamples: Record<BrandTone, string> = {
    cercano:     '¡Buenos días! ☀️ Empezamos el día con energía. ¿Nos cuentas cómo arrancas tú?',
    profesional: 'Nos complace presentar nuestra nueva propuesta. Calidad y excelencia en cada detalle.',
    divertido:   '¿Quién dijo que los lunes son aburridos? 🎉 ¡Nosotros tenemos el plan perfecto!',
    premium:     'Donde la artesanía encuentra la elegancia. Cada pieza, una experiencia única.',
  };
  const toneExamples = SECTOR_TONE_MAP[sector] ?? defaultToneExamples;

  const rightStep4 = (
    <div style={{ padding: '48px 40px', height: '100%' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 16 }}>
        Ejemplo de post con tu tono
      </div>
      <div style={{ background: '#ffffff', borderRadius: 0, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: ACCENT }} />
          <div>
            <div style={{ fontFamily: FONT, fontSize: '0.82rem', fontWeight: 700, color: INK }}>{name || 'tunegocio'}</div>
            <div style={{ fontFamily: FONT, fontSize: '0.7rem', color: MUTED }}>hace 2h</div>
          </div>
        </div>
        <img src={previewPosts[0]} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: '14px' }}>
          <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: INK, lineHeight: 1.6, marginBottom: 8 }}>
            {toneExamples[tone]}
          </div>
          {keywords.length > 0 && (
            <div style={{ fontFamily: FONT, fontSize: '0.8rem', color: ACCENT }}>
              {keywords.slice(0, 3).map((k) => `#${k}`).join(' ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const selectedPlanData = ONBOARDING_PLANS.find((p) => p.id === selectedPlan)!;
  const rightStep5 = (
    <div style={{ padding: '48px 40px', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
        Resumen de tu plan
      </div>
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.6rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {selectedPlanData.name}
          </div>
          {selectedPlanData.badge && (
            <span style={{
              background: selectedPlanData.featured ? ACCENT : INK,
              color: '#ffffff',
              fontFamily: FONT_C,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 9px',
            }}>
              {selectedPlanData.badge}
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
          {selectedPlanData.desc}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '2.6rem', color: INK, letterSpacing: '-0.02em' }}>
            {selectedPlanData.price}€
          </span>
          <span style={{ fontFamily: FONT, fontSize: 13, color: MUTED }}>/mes</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedPlanData.features.map((f) => (
            <li key={f} style={{ fontFamily: FONT, fontSize: 13, color: '#374151', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: ACCENT, fontWeight: 900, flexShrink: 0 }}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 'auto', padding: '16px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb', fontFamily: FONT, fontSize: '0.8rem', color: MUTED, lineHeight: 1.6 }}>
        Puedes cambiar de plan o cancelar cuando quieras desde los ajustes.
      </div>
    </div>
  );

  const rightContent = [rightStep1, rightStep2, rightStep3, rightStep4, rightStep5][step - 1];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="onboarding-page" style={{ position: 'fixed', inset: 0, display: 'flex', zIndex: 50, overflow: 'hidden' }}>

      {/* ── Left column (full-width on steps 1-2) ── */}
      <div style={{ width: step <= 4 ? '100%' : '58%', background: BG_L, display: 'flex', flexDirection: 'column', padding: step <= 4 ? '36px 56px' : '44px 48px', overflowY: 'auto', flexShrink: 0, transition: 'width 0.2s' }}>

        {/* Logo */}
        <Link href="/" style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.2rem', color: INK, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 36, flexShrink: 0, textDecoration: 'none', cursor: 'pointer' }}>
          NeuroPost
        </Link>

        {/* Progress tabs */}
        <div style={{ marginBottom: 28, flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            {([
              [1, 'Negocio'],
              [2, 'Estética'],
              [3, 'Tu negocio'],
              [4, 'Voz'],
              [5, 'Objetivo'],
            ] as [Step, string][]).map(([s, label]) => (
              <div
                key={s}
                onClick={() => { if ((s as number) < step) setStep(s); }}
                style={{
                  padding: '8px 14px 9px',
                  fontFamily: FONT_C,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: s === step ? INK : (s as number) < step ? MUTED : '#d1d5db',
                  borderBottom: s === step ? `2px solid ${INK}` : '2px solid transparent',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  cursor: (s as number) < step ? 'pointer' : 'default',
                  transition: 'color 0.15s',
                  userSelect: 'none',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Step 1: Sector ── */}
        {step === 1 && (() => {
          const filteredGroups = searchQuery.trim()
            ? MACRO_GROUPS.filter((g) =>
                g.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.sub.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.pills.some((p) => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
              )
            : MACRO_GROUPS;
          const activeGroup = MACRO_GROUPS.find((g) => g.id === selectedGroup);
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '4rem', color: '#e2e2e4', letterSpacing: '-0.04em', lineHeight: 1, flexShrink: 0, marginTop: -2 }}>01</span>
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', color: INK, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    ¿De qué trata tu negocio?
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                    Empieza por la categoría principal. En el siguiente paso afinarás el sector específico.
                  </div>
                </div>
              </div>

              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Busca tu sector (ej. clínica dental, barbería)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', fontFamily: FONT, fontSize: '0.88rem', color: INK, background: 'transparent' }}
                />
              </div>

              {/* 3×2 group grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {filteredGroups.map((group) => {
                  const isSelected = selectedGroup === group.id;
                  const ic = isSelected ? '#fff' : INK;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(group.id);
                        setSector(group.defaultSector);
                        setSecondarySectors([]);
                        setCustomSectorLabel('');
                        setActivePillLabel('');
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        padding: '20px 18px', textAlign: 'left', cursor: 'pointer', outline: 'none',
                        border: `1px solid ${isSelected ? INK : '#e2e2e4'}`,
                        background: isSelected ? INK : '#fff',
                        transition: 'border-color 0.15s, background 0.15s',
                        position: 'relative',
                      }}
                    >
                      <div style={{ marginBottom: 14, color: ic }}>
                        <GroupIcon id={group.id} color={ic} />
                      </div>
                      <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1rem', color: isSelected ? '#fff' : INK, textTransform: 'uppercase', letterSpacing: '0.01em', marginBottom: 6, lineHeight: 1.15 }}>
                        {group.label}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: '0.72rem', color: isSelected ? 'rgba(255,255,255,0.55)' : MUTED, lineHeight: 1.55 }}>
                        {group.sub}
                      </div>
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, border: '1.5px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#fff', fontWeight: 900 }}>✓</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Refinement pills */}
              {activeGroup && (
                <div style={{ padding: '14px 16px', background: '#fff', border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                  <div style={{ fontFamily: FONT, fontSize: '0.82rem', color: INK, marginBottom: 12 }}>
                    Has elegido <strong>{activeGroup.label}</strong>. Afina el tipo exacto:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {activeGroup.pills.map((pill) => {
                      const isActive = activePillLabel === pill.label;
                      return (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() => { setSector(pill.sector); setActivePillLabel(pill.label); setCustomSectorLabel(pill.label); }}
                          style={{
                            padding: '7px 14px',
                            border: `1.5px solid ${isActive ? INK : BORDER}`,
                            background: isActive ? INK : '#fff',
                            color: isActive ? '#fff' : INK,
                            fontFamily: FONT, fontWeight: 600, fontSize: '0.8rem',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { setSector('otro'); setActivePillLabel('__otro__'); setCustomSectorLabel(''); }}
                      style={{
                        padding: '7px 14px',
                        border: `1.5px dashed ${activePillLabel === '__otro__' ? INK : BORDER}`,
                        background: '#fff', color: MUTED,
                        fontFamily: FONT, fontWeight: 600, fontSize: '0.8rem',
                        cursor: 'pointer', outline: 'none',
                      }}
                    >
                      + otro
                    </button>
                  </div>
                  {activePillLabel === '__otro__' && (
                    <input
                      type="text"
                      placeholder="Describe tu tipo de negocio..."
                      value={customSectorLabel}
                      onChange={(e) => setCustomSectorLabel(e.target.value)}
                      style={{ width: '100%', marginTop: 12, padding: '7px 0', border: 'none', borderBottom: `1.5px solid ${BORDER}`, fontFamily: FONT, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', background: 'transparent', color: INK }}
                    />
                  )}
                </div>
              )}

              <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, paddingBottom: 4, background: `linear-gradient(to top, ${BG_L} 70%, transparent)`, marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <BtnPrimary onClick={() => setStep(2)}>Continuar →</BtnPrimary>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Step 2: Visual style ── */}
        {step === 2 && (() => {
          const recommended: VisualStyle[] = STYLE_RECOMMENDATIONS[selectedGroup ?? ''] ?? ['fresh', 'editorial', 'dynamic'];
          const others = VISUAL_STYLES.filter((s) => !recommended.includes(s.value));
          const selectedStyleData = VISUAL_STYLES.find((s) => s.value === visualStyle);
          const groupLabel = MACRO_GROUPS.find((g) => g.id === selectedGroup)?.label ?? '';

          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '4rem', color: '#e2e2e4', letterSpacing: '-0.04em', lineHeight: 1, flexShrink: 0, marginTop: -2 }}>02</span>
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', color: INK, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    ¿Cómo quieres que se vea tu feed?
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                    Elige la estética base y afina los detalles. Podrás cambiarla más adelante.
                  </div>
                </div>
              </div>

              {/* Recommendation tag */}
              {groupLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontFamily: FONT, fontSize: '0.78rem', color: INK, fontWeight: 600 }}>
                  <span>★</span>
                  <span>Recomendado para <strong>{groupLabel.toLowerCase()}</strong></span>
                </div>
              )}

              {/* Top 3 featured style cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {recommended.map((styleVal) => {
                  const style = VISUAL_STYLES.find((s) => s.value === styleVal)!;
                  const selected = visualStyle === styleVal;
                  return (
                    <button
                      key={styleVal}
                      type="button"
                      onClick={() => setVisualStyle(styleVal)}
                      style={{
                        padding: 0, cursor: 'pointer', outline: 'none', textAlign: 'left',
                        border: `2px solid ${selected ? INK : '#e2e2e4'}`,
                        background: '#fff', position: 'relative', overflow: 'hidden',
                      }}
                    >
                      <div style={{ position: 'relative', height: 150, overflow: 'hidden' }}>
                        <img
                          src={getFeaturedPhoto(styleVal, sector)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#e5e7eb' }}
                        />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)', display: 'flex', alignItems: 'flex-end', padding: '10px 12px' }}>
                          <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.05rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.02em', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                            {style.title}
                          </span>
                        </div>
                        {selected && (
                          <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, background: INK, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', fontWeight: 900 }}>✓</div>
                        )}
                      </div>
                      <div style={{ padding: '9px 12px', background: selected ? INK : '#fff' }}>
                        <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '0.85rem', color: selected ? '#fff' : INK, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 2 }}>
                          {style.title}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: '0.65rem', color: selected ? 'rgba(255,255,255,0.55)' : MUTED, lineHeight: 1.4 }}>
                          {STYLE_DESCRIPTORS[styleVal]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* "Otras estéticas" smaller row */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FONT, fontSize: '0.7rem', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Otras estéticas
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${others.length}, 1fr)`, gap: 6 }}>
                  {others.map((style) => {
                    const selected = visualStyle === style.value;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setVisualStyle(style.value)}
                        style={{
                          padding: 0, cursor: 'pointer', outline: 'none', textAlign: 'left',
                          border: `2px solid ${selected ? INK : '#e2e2e4'}`,
                          background: '#fff', position: 'relative', overflow: 'hidden',
                        }}
                      >
                        <img
                          src={getThumbnailPhoto(style.value, sector)}
                          alt=""
                          style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block', background: '#e5e7eb' }}
                        />
                        <div style={{ padding: '6px 8px', background: selected ? INK : '#fff' }}>
                          <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '0.7rem', color: selected ? '#fff' : INK, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            {style.title}
                          </div>
                        </div>
                        {selected && (
                          <div style={{ position: 'absolute', top: 5, right: 5, width: 15, height: 15, background: INK, border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', color: '#fff', fontWeight: 900 }}>✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Refinement sliders */}
              <div style={{ padding: '14px 16px', background: '#fff', border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.78rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                  Afinar {selectedStyleData?.title ?? 'estilo'}:
                </div>
                {([
                  { label: 'Realismo', lo: 'Artístico', hi: 'Fotorrealista', val: realismLevel, set: setRealismLevel },
                ] as const).map(({ label, lo, hi, val, set }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT, fontSize: '0.75rem', color: MUTED }}>{label}</span>
                      <span style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.72rem', color: INK }}>{val}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: FONT, fontSize: '0.68rem', color: MUTED, flexShrink: 0 }}>{lo}</span>
                      <input
                        type="range" min={0} max={100} value={val}
                        onChange={(e) => set(Number(e.target.value))}
                        style={{ flex: 1, accentColor: INK, cursor: 'pointer', height: 2 }}
                      />
                      <span style={{ fontFamily: FONT, fontSize: '0.68rem', color: MUTED, flexShrink: 0 }}>{hi}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom nav */}
              <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, paddingBottom: 4, background: `linear-gradient(to top, ${BG_L} 70%, transparent)`, marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <BtnBack onClick={() => setStep(1)} />
                  <BtnPrimary onClick={() => setStep(3)}>Continuar →</BtnPrimary>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Step 3: Business details ── */}
        {step === 3 && (() => {
          const groupLabel      = MACRO_GROUPS.find((g) => g.id === selectedGroup)?.label ?? '';
          const styleTitle      = VISUAL_STYLES.find((s) => s.value === visualStyle)?.title ?? '';
          const specialtyOpts   = SECTOR_SERVICE_OPTIONS[sector] ?? [];
          const customSpecialties = specialties.filter((s) => !specialtyOpts.includes(s));
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 760, margin: '0 auto', width: '100%' }}>

              {/* Recap bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: INK, color: '#fff', fontFamily: FONT, fontSize: '0.76rem', marginBottom: 28, flexWrap: 'wrap' }}>
                <span style={{ opacity: 0.45, fontWeight: 400 }}>Hasta ahora:</span>
                {groupLabel && <span style={{ fontWeight: 700 }}>{groupLabel}</span>}
                {activePillLabel && activePillLabel !== '__otro__' && <span style={{ opacity: 0.65 }}>· {activePillLabel}</span>}
                <span style={{ opacity: 0.65 }}>· {styleTitle}</span>
                <span style={{ opacity: 0.45 }}>· {realismLevel}% realismo</span>
              </div>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 28 }}>
                <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '4rem', color: '#e2e2e4', letterSpacing: '-0.04em', lineHeight: 1, flexShrink: 0, marginTop: -2 }}>03</span>
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', color: INK, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    Tu negocio en detalle
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                    Nombre, especialidades, ubicación y logo. Todo en un minuto.
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Personal name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label>Tu nombre</Label>
                    <input style={inputStyle} type="text" placeholder="Ej: Ana" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
                  </div>
                  <div>
                    <Label>Apellidos</Label>
                    <input style={inputStyle} type="text" placeholder="Ej: García López" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>

                {/* Business name */}
                <div>
                  <Label>Nombre del negocio *</Label>
                  <input style={inputStyle} type="text" placeholder="Ej: Heladería La Nube" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                {/* Specialty chips */}
                <div>
                  <Label>
                    Especialidades{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(elige las que apliquen)</span>
                  </Label>
                  {specialtyOpts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {specialtyOpts.map((opt) => {
                        const active = specialties.includes(opt);
                        return (
                          <PillOption key={opt} active={active} onClick={() =>
                            setSpecialties((prev) => active ? prev.filter((s) => s !== opt) : [...prev, opt])
                          }>
                            {opt}
                          </PillOption>
                        );
                      })}
                    </div>
                  )}
                  {customSpecialties.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {customSpecialties.map((s) => (
                        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 12px', background: ACCENT, color: '#fff', fontFamily: FONT, fontSize: '0.82rem', fontWeight: 700 }}>
                          {s}
                          <button type="button" onClick={() => setSpecialties((prev) => prev.filter((x) => x !== s))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Añadir especialidad (pulsa Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = e.target as HTMLInputElement;
                        const v = t.value.trim();
                        if (v && !specialties.includes(v)) setSpecialties((prev) => [...prev, v]);
                        t.value = '';
                      }
                    }}
                  />
                </div>

                {/* Location — single free-text */}
                <div>
                  <Label>
                    Ubicación{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
                  </Label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Ej: Gràcia, Barcelona, España"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <p style={{ fontFamily: FONT, fontSize: '0.72rem', color: MUTED, marginTop: 5, lineHeight: 1.4 }}>
                    Con la ciudad el agente detecta fiestas locales y las marca en tu calendario.
                  </p>
                </div>

                {/* Logo upload */}
                <div>
                  <Label>
                    Logo{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional · se aplica en los posts)</span>
                  </Label>
                  <LogoUpload
                    logoUrl={logoUrl}
                    colors={extractedColors}
                    onLogoUrl={setLogoUrl}
                    onColors={(cols) => {
                      setExtractedColors(cols);
                      if (cols[0]) setPrimaryColor(cols[0]);
                      if (cols[1]) setSecondaryColor(cols[1]);
                      if (cols[2]) setTertiaryColor(cols[2]);
                      setHasCustomPalette(true);
                    }}
                  />
                </div>

              </div>

              <div style={{ position: 'sticky', bottom: 0, paddingTop: 12, paddingBottom: 4, background: `linear-gradient(to top, ${BG_L} 70%, transparent)`, marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <BtnBack onClick={() => setStep(2)} />
                  <BtnPrimary onClick={() => { if (!name.trim()) { toast.error('El nombre es obligatorio'); return; } setStep(4); }}>Siguiente →</BtnPrimary>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Step 4: Brand voice ── */}
        {step === 4 && (() => {
          const groupLabel  = MACRO_GROUPS.find((g) => g.id === selectedGroup)?.label ?? '';
          const sectorLabel = activePillLabel && activePillLabel !== '__otro__' ? activePillLabel : groupLabel;
          const styleTitle  = VISUAL_STYLES.find((s) => s.value === visualStyle)?.title ?? '';
          const suggestions = SECTOR_KEYWORD_SUGGESTIONS[sector]
            ?? ['artesanal', 'local', 'calidad', 'sostenible', 'profesional', 'exclusivo', 'fresco', 'auténtico'];
          const customKeywords = keywords.filter((kw) => !suggestions.includes(kw));
          const PUBLISH_CARDS: { value: PublishMode; label: string; desc: string; note: string }[] = [
            { value: 'semi',   label: 'Supervisado',    desc: 'Apruebas cada post antes de publicar.',  note: 'Todos los planes' },
            { value: 'auto',   label: 'Automático',     desc: 'Publicamos sin que apruebes cada post.', note: 'Profesional' },
          ];
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 760, margin: '0 auto', width: '100%' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '4rem', color: '#e2e2e4', letterSpacing: '-0.04em', lineHeight: 1, flexShrink: 0, marginTop: -2 }}>04</span>
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', color: INK, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    Tu voz de marca
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
                    Define cómo suena tu marca. Cada detalle va al prompt de los agentes.
                  </div>
                </div>
              </div>

              {/* Recap bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#f0fdf4', border: `1px solid #bbf7d0`, fontFamily: FONT, fontSize: '0.78rem', color: '#166534', marginBottom: 24, flexWrap: 'wrap' }}>
                <span style={{ color: ACCENT, fontWeight: 900, fontSize: '0.85rem' }}>✓</span>
                {name && <strong>{name}</strong>}
                {sectorLabel && <span style={{ opacity: 0.7 }}>· {sectorLabel.toLowerCase()}{location ? ` en ${location.split(',')[0]}` : ''}</span>}
                <span style={{ opacity: 0.7 }}>· estética {styleTitle}</span>
                <span style={{ opacity: 0.7 }}>· {realismLevel}% fotos reales</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 20 }}>

                {/* Keywords */}
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.9rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                    Palabras clave sugeridas para tu {sectorLabel.toLowerCase() || 'negocio'}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                    Basadas en tu especialidad. Marca las que encajan con tu marca.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {suggestions.map((kw) => {
                      const active = keywords.includes(kw);
                      return (
                        <button key={kw} type="button"
                          onClick={() => active ? removeTag(keywords, setKeywords, kw) : addTag(keywords, setKeywords, kw)}
                          style={{
                            padding: '7px 16px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.83rem', fontWeight: 700,
                            border: `1.5px solid ${active ? INK : BORDER}`,
                            background: active ? INK : '#fff',
                            color: active ? '#fff' : '#374151',
                            transition: 'all 0.15s', outline: 'none',
                          }}
                        >{kw}</button>
                      );
                    })}
                  </div>
                  {customKeywords.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {customKeywords.map((kw) => (
                        <span key={kw} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 14px', background: INK, color: '#fff', fontFamily: FONT, fontSize: '0.82rem', fontWeight: 700 }}>
                          {kw}
                          <button type="button" onClick={() => removeTag(keywords, setKeywords, kw)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    style={{ ...inputStyle, marginTop: 10 }}
                    type="text"
                    placeholder="Añade otra palabra clave (pulsa Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = e.target as HTMLInputElement;
                        t.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).forEach((kw) => {
                          if (!keywords.includes(kw)) addTag(keywords, setKeywords, kw);
                        });
                        t.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      const t = e.target as HTMLInputElement;
                      if (t.value.trim()) {
                        t.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).forEach((kw) => {
                          if (!keywords.includes(kw)) addTag(keywords, setKeywords, kw);
                        });
                        t.value = '';
                      }
                    }}
                  />
                </div>

                {/* Palabras a evitar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.9rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Palabras a evitar
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                    Clichés o términos que nunca quieres ver en tus publicaciones.
                  </div>
                  {forbidden.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {forbidden.map((w) => (
                        <span key={w} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 14px', background: '#fff', border: `1.5px solid ${BORDER}`, color: INK, fontFamily: FONT, fontSize: '0.82rem', fontWeight: 600 }}>
                          {w}
                          <button type="button" onClick={() => removeTag(forbidden, setForbidden, w)} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Añade palabra o frase a evitar (pulsa Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = e.target as HTMLInputElement;
                        const v = t.value.trim();
                        if (v && !forbidden.includes(v)) addTag(forbidden, setForbidden, v);
                        t.value = '';
                      }
                    }}
                    onBlur={(e) => {
                      const t = e.target as HTMLInputElement;
                      const v = t.value.trim();
                      if (v && !forbidden.includes(v)) addTag(forbidden, setForbidden, v);
                      t.value = '';
                    }}
                  />
                </div>

                {/* Idioma + Uso de emojis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.9rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      Idioma
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        ['castellano', 'Castellano'],
                        ['catalan',    'Catalán'],
                        ['bilingual',  'Bilingüe'],
                      ] as const).map(([val, lbl]) => {
                        const active = language === val;
                        return (
                          <button key={val} type="button" onClick={() => setLanguage(val)} style={{
                            padding: '8px 14px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 700,
                            border: `1.5px solid ${active ? INK : BORDER}`,
                            background: active ? INK : '#fff',
                            color: active ? '#fff' : '#374151',
                            outline: 'none', transition: 'all 0.15s',
                          }}>{lbl}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.9rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      Uso de emojis
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        ['none',     'Ninguno'],
                        ['moderate', 'Moderado'],
                        ['free',     'Libre'],
                      ] as const).map(([val, lbl]) => {
                        const active = emojiUse === val;
                        return (
                          <button key={val} type="button" onClick={() => setEmojiUse(val)} style={{
                            padding: '8px 14px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 700,
                            border: `1.5px solid ${active ? ACCENT : BORDER}`,
                            background: active ? ACCENT : '#fff',
                            color: active ? '#fff' : '#374151',
                            outline: 'none', transition: 'all 0.15s',
                          }}>{lbl}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modo de publicación */}
                <div>
                  <div style={{ fontFamily: FONT_C, fontWeight: 700, fontSize: '0.9rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                    Modo de publicación
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                    Cuánto control quieres antes de que publiquemos.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {PUBLISH_CARDS.map((m) => {
                      const active = publishMode === m.value;
                      return (
                        <button key={m.value} type="button" onClick={() => setPublishMode(m.value)} style={{
                          padding: '16px 14px', cursor: 'pointer', textAlign: 'left', outline: 'none',
                          border: `1.5px solid ${active ? INK : BORDER}`,
                          background: active ? INK : '#fff',
                          transition: 'all 0.15s',
                          display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
                        }}>
                          {active && (
                            <div style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, border: '1.5px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#fff', fontWeight: 900 }}>✓</div>
                          )}
                          <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '0.95rem', color: active ? '#fff' : INK, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            {m.label}
                          </div>
                          <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: active ? 'rgba(255,255,255,0.65)' : MUTED, lineHeight: 1.5 }}>
                            {m.desc}
                          </div>
                          <div style={{ fontFamily: FONT, fontSize: '0.68rem', fontWeight: 700, color: active ? 'rgba(255,255,255,0.4)' : '#d1d5db', marginTop: 2 }}>
                            {m.note}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
                <button type="button" onClick={() => setStep(3)} style={{ background: 'none', border: 'none', fontFamily: FONT, fontSize: '0.85rem', color: MUTED, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ← Anterior
                </button>
                <BtnPrimary onClick={() => isRedo ? handleSubmit() : setStep(5)}>
                  {isRedo ? (saving ? 'Guardando…' : 'Guardar cambios →') : 'Continuar →'}
                </BtnPrimary>
              </div>
            </div>
          );
        })()}

        {/* ── Step 5: Subscription plan + coupon ── */}
        {step === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SectionTitle>Elige tu plan</SectionTitle>
            <StepSub>Selecciona el plan que mejor se adapta a tu negocio. Puedes cambiarlo cuando quieras.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {ONBOARDING_PLANS.map((plan) => {
                  const selected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      style={{
                        position: 'relative',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        border: `2px solid ${selected ? ACCENT : '#e5e7eb'}`,
                        background: selected ? 'rgba(15,118,110,0.04)' : '#ffffff',
                        outline: 'none',
                        transition: 'all 0.15s',
                        boxShadow: selected ? `0 0 0 4px rgba(15,118,110,0.12)` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {plan.badge && (
                        <div style={{
                          position: 'absolute',
                          top: -1,
                          right: -1,
                          background: plan.featured ? ACCENT : INK,
                          color: '#ffffff',
                          fontFamily: FONT_C,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '5px 10px',
                        }}>
                          {plan.badge}
                        </div>
                      )}
                      <div style={{ padding: '22px 18px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.15rem', color: INK, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 6 }}>
                          {plan.name}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED, lineHeight: 1.5, minHeight: 32 }}>
                          {plan.desc}
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.9rem', color: INK, letterSpacing: '-0.02em' }}>{plan.price}€</span>
                          <span style={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>/mes</span>
                        </div>
                      </div>
                      <ul style={{ listStyle: 'none', padding: '14px 18px 18px', margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {plan.features.map((f) => (
                          <li key={f} style={{ fontFamily: FONT, fontSize: 11, color: '#374151', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ color: ACCENT, fontWeight: 900, flexShrink: 0 }}>✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {selected && (
                        <div style={{ padding: '10px 18px', background: ACCENT, color: '#ffffff', fontFamily: FONT_C, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginTop: 'auto' }}>
                          ✓ Seleccionado
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: '20px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
                <Label>¿Tienes un código de descuento?</Label>
                <CouponInput
                  onValidCoupon={(id, text) => { setPromoCodeId(id); setDiscountText(text); }}
                  onClearCoupon={() => { setPromoCodeId(null); setDiscountText(''); }}
                />
                {discountText && (
                  <p style={{ fontSize: '0.8rem', color: ACCENT, marginTop: 8, fontFamily: FONT, fontWeight: 700 }}>
                    {discountText}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0, paddingBottom: 4 }}>
              <BtnBack onClick={() => setStep(4)} />
              <BtnPrimary onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Configurando...</>
                ) : '¡Empezar a publicar!'}
              </BtnPrimary>
            </div>
          </div>
        )}
      </div>

      {/* ── Right column (only step 5) ── */}
      {step > 4 && (
        <div style={{ flex: 1, background: BG_R, borderLeft: `1px solid ${BORDER}`, overflowY: 'auto' }}>
          {rightContent}
        </div>
      )}

      <style jsx>{`
        .brandColorPicker {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brandColorInput {
          width: 44px;
          height: 44px;
          border-radius: 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          padding: 2px;
          background: none;
        }

        .brandColorLabel {
          display: block;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: 'Barlow', sans-serif;
          color: ${INK};
        }

        .brandColorValue {
          font-size: 0.72rem;
          color: ${MUTED};
        }
      `}</style>
    </div>
  );
}
