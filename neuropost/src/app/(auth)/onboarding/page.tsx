'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { SocialSector, BrandTone, PublishMode, PostGoal, VisualStyle } from '@/types';
import { TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { useTagInput } from '@/hooks/useTagInput';
import CouponInput from '@/components/billing/CouponInput';
import { getTemplateForSector } from '@/lib/industry-templates';

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
  otro:             'business,storefront',
};

// Secondary modifier per visual style. Combined with the sector keyword to get
// images that already "feel" like that style, so we don't rely on CSS filters.
const STYLE_KEYWORD: Record<VisualStyle, string> = {
  creative:  'colorful',
  elegant:   'minimal',
  warm:      'warm',
  dynamic:   'modern',
  // These variants exist in the VisualStyle type but aren't selectable in the
  // current UI. Map them anyway so the type is exhaustive.
  editorial: 'editorial',
  dark:      'dark',
  fresh:     'fresh',
  vintage:   'vintage',
};

// Seeds per style for step 2 — distinct ranges so every card shows a
// different set of photos and the right preview never overlaps.
const STYLE_SEED: Record<VisualStyle, number> = {
  creative:  100,
  elegant:   200,
  warm:      300,
  dynamic:   400,
  editorial: 500,
  dark:      600,
  fresh:     700,
  vintage:   800,
};

// Three post images for the step 1 mock feed — themed to the selected sector.
function sectorPostsFor(sector: SocialSector): string[] {
  const kw = SECTOR_KEYWORD[sector];
  return [IMG(kw, 1, 500), IMG(kw, 2, 500), IMG(kw, 3, 500)];
}

// ─── Sector data with images ──────────────────────────────────────────────────

type SectorItem = { value: SocialSector; label: string; img: string };
type SectorGroup = { group: string; items: SectorItem[] };

// Thumbnail for each sector card in step 1 — seed 0 keeps it stable across
// reloads while still pulling a photo that matches the sector keyword.
const THUMB = (sector: SocialSector) => IMG(SECTOR_KEYWORD[sector], 0);

const SECTOR_GROUPS: SectorGroup[] = [
  { group: 'Comida y Bebida', items: [
    { value: 'restaurante', label: 'Gastronomía',        img: THUMB('restaurante') },
    { value: 'heladeria',   label: 'Heladería',           img: THUMB('heladeria')   },
    { value: 'cafeteria',   label: 'Cafetería / Brunch', img: THUMB('cafeteria')   },
    { value: 'cocteleria',  label: 'Cócteles / Bar',     img: THUMB('cocteleria')  },
    { value: 'street_food', label: 'Street Food',        img: THUMB('street_food') },
    { value: 'vinoteca',    label: 'Vinoteca',           img: THUMB('vinoteca')    },
    { value: 'panaderia',   label: 'Panadería',          img: THUMB('panaderia')   },
  ]},
  { group: 'Belleza y Estética', items: [
    { value: 'barberia',   label: 'Barbería',    img: THUMB('barberia')   },
    { value: 'nail_art',   label: 'Nail Art',    img: THUMB('nail_art')   },
    { value: 'estetica',   label: 'Centro Spa',  img: THUMB('estetica')   },
    { value: 'maquillaje', label: 'Cosmética',   img: THUMB('maquillaje') },
  ]},
  { group: 'Moda y Estilo', items: [
    { value: 'boutique',    label: 'Boutique',    img: THUMB('boutique')    },
    { value: 'moda_hombre', label: 'Moda Hombre', img: THUMB('moda_hombre') },
    { value: 'zapateria',   label: 'Zapatería',   img: THUMB('zapateria')   },
    { value: 'skincare',    label: 'Skincare',    img: THUMB('skincare')    },
  ]},
  { group: 'Salud y Bienestar', items: [
    { value: 'gym',       label: 'Gimnasio / Fitness', img: THUMB('gym')       },
    { value: 'yoga',      label: 'Yoga / Pilates',     img: THUMB('yoga')      },
    { value: 'dental',    label: 'Clínica Dental',     img: THUMB('dental')    },
    { value: 'clinica',   label: 'Clínica / Medicina', img: THUMB('clinica')   },
    { value: 'nutricion', label: 'Nutrición',          img: THUMB('nutricion') },
  ]},
  { group: 'Hogar y Servicios', items: [
    { value: 'decoracion',  label: 'Decoración',   img: THUMB('decoracion')   },
    { value: 'jardineria',  label: 'Jardinería',   img: THUMB('jardineria')   },
    { value: 'reformas',    label: 'Reformas',     img: THUMB('reformas')     },
    { value: 'inmobiliaria',label: 'Inmobiliaria', img: THUMB('inmobiliaria') },
    { value: 'fotografia',  label: 'Fotografía',   img: THUMB('fotografia')   },
    { value: 'floristeria', label: 'Floristería',  img: THUMB('floristeria')  },
    { value: 'otro',        label: 'Otro negocio', img: THUMB('otro')         },
  ]},
];

// ─── Visual style data ────────────────────────────────────────────────────────

const VISUAL_STYLES: {
  value: VisualStyle; title: string; tag: string; palette: string[];
}[] = [
  { value: 'creative', title: 'Creativo y Colorido', tag: 'Impactante · Editorial · Vibrante',
    palette: ['#FF6B9D','#FF9500','#34C759','#007AFF'] },
  { value: 'elegant', title: 'Elegante y Minimal', tag: 'Limpio · Sofisticado · Premium',
    palette: ['#F5F5F0','#D4C5B0','#8B7355','#2C2C2C'] },
  { value: 'warm', title: 'Cálido y Cercano', tag: 'Auténtico · Local · Próximo',
    palette: ['#D4916A','#C17D52','#F2CDA0','#8B4513'] },
  { value: 'dynamic', title: 'Dinámico y Moderno', tag: 'Energía · Urbano · Tendencia',
    palette: ['#1C1C1E','#FF3B30','#636366','#AEAEB2'] },
];

// ─── Sector-aware visual images ──────────────────────────────────────────────
// All step 2 photos are generated deterministically from loremflickr:
//   - 4 photos per (sector, style) for each style card on the left
//   - 9 photos per (sector, style) for the right-column preview
// Seeds are chosen in disjoint ranges so nothing overlaps across styles or
// between the left cards and the right preview.

function getSectorStyleImages(sector: SocialSector, style: VisualStyle): string[] {
  const kw = `${SECTOR_KEYWORD[sector]},${STYLE_KEYWORD[style]}`;
  const base = STYLE_SEED[style];
  // Seeds 1..4 (relative to STYLE_SEED) for the 4 card thumbnails.
  return [1, 2, 3, 4].map((i) => IMG(kw, base + i));
}

function getSectorPreviewImages(sector: SocialSector, style: VisualStyle): string[] {
  const kw = `${SECTOR_KEYWORD[sector]},${STYLE_KEYWORD[style]}`;
  const base = STYLE_SEED[style];
  // Seeds 10..18 — never overlap with the 1..4 used for the cards.
  return [10, 11, 12, 13, 14, 15, 16, 17, 18].map((i) => IMG(kw, base + i, 500));
}

const SECTOR_CAPTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante:  ['El mejor risotto de la ciudad 🍝', 'Mesa lista para esta noche ✨', 'Ingredientes frescos cada mañana 🌿'],
  heladeria:    ['Pistacho artesanal recién hecho 🍦', 'El sabor del verano ☀️', 'Hecho con amor desde 1995 💛'],
  cafeteria:    ['Empieza el día con el mejor café ☕', 'Brunch perfecto para el domingo 🥑', 'Tu rincón favorito te espera 🌸'],
  gym:          ['Sin excusas, solo resultados 💪', 'Tu mejor versión empieza hoy 🔥', 'Clase de las 7am. ¿Te apuntas? ⚡'],
  barberia:     ['Corte clásico, estilo eterno ✂️', 'Cuida tu imagen, cuida tu actitud 💈', 'Reserva ya tu cita 📞'],
  boutique:     ['Nueva colección ya en tienda 🛍️', 'Tu look para este fin de semana ✨', 'Piezas únicas que marcan diferencia 💎'],
  inmobiliaria: ['Tu hogar soñado te espera 🏠', 'Ático con vistas espectaculares ☀️', 'Inversión segura en zona premium 📍'],
  floristeria:  ['Ramos que enamoran 🌺', 'Frescura que se siente 🌸', 'Arte floral para cada ocasión 💐'],
  yoga:         ['Respira, fluye, conecta 🧘', 'Tu momento de paz empieza aquí ☮️', 'Clase al amanecer mañana 🌅'],
  cocteleria:   ['Cócteles de autor para esta noche 🍸', 'Descubre nuestro nuevo old fashioned 🥃', 'Happy hour de 18 a 20h 🎉'],
  street_food:  ['El smash burger que vas a soñar 🍔', 'Comida callejera nivel gourmet 🔥', 'Nuevo especial del mes 🌮'],
  vinoteca:     ['Tintos que cuentan historias 🍷', 'Cata de vinos naturales este jueves 🥂', 'Maridaje perfecto para el fin de semana 🧀'],
  panaderia:    ['Pan de masa madre recién horneado 🍞', 'Bollería del día, irresistible ☕', 'Tradición y harina en cada bocado 🥐'],
  nail_art:     ['Nail art de temporada 💅', 'Diseños únicos para ti ✨', 'Tu próxima manicura te espera 🎨'],
  estetica:     ['Relájate, estás en buenas manos 🧖', 'Tratamiento facial renovador ✨', 'Tu bienestar es nuestra prioridad 💆'],
  maquillaje:   ['Looks que transforman 💄', 'Colección primavera ya disponible 🌸', 'Maquillaje que resalta tu belleza ✨'],
  moda_hombre:  ['Estilo sin esfuerzo 🎩', 'Nueva colección otoño-invierno 🧥', 'Cada detalle importa 👔'],
  skincare:     ['Tu piel merece lo mejor 🧴', 'Rutina coreana paso a paso ✨', 'Ingredientes naturales, resultados reales 🌿'],
  dental:       ['Sonríe sin complejos 😁', 'Blanqueamiento profesional ✨', 'Tu salud dental en las mejores manos 🦷'],
  clinica:      ['Tu bienestar, nuestra prioridad 🏥', 'Equipo médico de confianza 👨‍⚕️', 'Tecnología al servicio de tu salud ⚕️'],
  nutricion:    ['Come bien, vive mejor 🥗', 'Plan personalizado para ti 📋', 'Alimentación consciente y equilibrada 🍎'],
  decoracion:   ['Transforma tu espacio ✨', 'Detalles que marcan diferencia 🏡', 'Diseño interior con personalidad 🎨'],
  jardineria:   ['Tu jardín merece lo mejor 🌿', 'Primavera en cada rincón 🌻', 'Verde que inspira calma 🌳'],
  reformas:     ['De proyecto a realidad 🔨', 'Reforma integral con estilo ✨', 'Tu espacio, reinventado 🏗️'],
  fotografia:   ['Momentos que perduran 📸', 'Tu historia en cada imagen ✨', 'Luz natural, emociones reales 🎞️'],
};
const DEFAULT_CAPTIONS = ['Contenido adaptado a tu negocio ✨', 'Tu historia, nuestra voz 🎯', 'Conectamos con tu audiencia 💬'];

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

// Country dropdown grouped by region. Covers Europe, Latin America (incl.
// Caribbean and Central America), South America and North America.
const COUNTRY_GROUPS: { region: string; countries: string[] }[] = [
  {
    region: 'Europa',
    countries: [
      'Alemania', 'Andorra', 'Austria', 'Bélgica', 'Bielorrusia',
      'Bosnia y Herzegovina', 'Bulgaria', 'Chipre', 'Croacia', 'Dinamarca',
      'Eslovaquia', 'Eslovenia', 'España', 'Estonia', 'Finlandia', 'Francia',
      'Grecia', 'Hungría', 'Irlanda', 'Islandia', 'Italia', 'Letonia',
      'Liechtenstein', 'Lituania', 'Luxemburgo', 'Macedonia del Norte',
      'Malta', 'Moldavia', 'Mónaco', 'Montenegro', 'Noruega', 'Países Bajos',
      'Polonia', 'Portugal', 'Reino Unido', 'República Checa', 'Rumanía',
      'San Marino', 'Serbia', 'Suecia', 'Suiza', 'Ucrania', 'Vaticano',
    ],
  },
  {
    region: 'América del Norte',
    countries: ['Canadá', 'Estados Unidos', 'México'],
  },
  {
    region: 'Centroamérica y Caribe',
    countries: [
      'Belice', 'Costa Rica', 'Cuba', 'El Salvador', 'Guatemala',
      'Haití', 'Honduras', 'Jamaica', 'Nicaragua', 'Panamá',
      'Puerto Rico', 'República Dominicana', 'Trinidad y Tobago',
    ],
  },
  {
    region: 'América del Sur',
    countries: [
      'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador',
      'Guyana', 'Paraguay', 'Perú', 'Surinam', 'Uruguay', 'Venezuela',
    ],
  },
];

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

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '14px 40px 14px 16px',
  background: '#ffffff',
  border: `1px solid ${BORDER}`,
  borderRadius: 0, color: INK,
  fontFamily: FONT,
  fontSize: 14, outline: 'none', cursor: 'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '14px',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
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

function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
      {children}
    </div>
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

function MockPost({ img, caption, index }: { img: string; caption: string; index: number }) {
  const likes = [234, 189, 312];
  const comms = [18, 24, 9];
  return (
    <div style={{
      background: '#ffffff', overflow: 'hidden',
      border: '1px solid #e5e7eb', width: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f3f4f6', height: 44, boxSizing: 'border-box' }}>
        <div style={{ width: 26, height: 26, background: ACCENT, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: '0.72rem', fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@tunegocio</span>
      </div>
      <img src={img} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', background: '#f3f4f6' }} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 72, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: '0.72rem', color: MUTED }}>♥ {likes[index]}</span>
          <span style={{ fontSize: '0.72rem', color: MUTED }}>💬 {comms[index]}</span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: '0.72rem', color: INK, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {caption}
        </div>
      </div>
    </div>
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
    price:     25,
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
    price:     76,
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
    price:  161,
    desc:  'Control completo',
    badge: 'Completo',
    features: [
      '📷  Hasta 20 fotos/semana · 🎬  10 vídeo/reel ≤90s · ⭐  Carruseles hasta 20',
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
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();
  const [step,   setStep]   = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // User personal info
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  const [sector,           setSector]           = useState<SocialSector>('restaurante');
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
  const [country, setCountry] = useState('España');
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

  // ── Content categories ────────────────────────────────────────────────────────
  const [contentCategories, setContentCategories] = useState<ContentCategoryDraft[]>([]);
  const [catInput,           setCatInput]          = useState('');
  const [catSuggestions,     setCatSuggestions]    = useState<string[]>([]);
  const [catSugLoading,      setCatSugLoading]     = useState(false);
  const catDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load template categories when sector changes
  useEffect(() => {
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
  }, [sector]);

  const toggleCategory = useCallback((key: string) => {
    setContentCategories((prev) =>
      prev.map((c) => c.category_key === key ? { ...c, active: !c.active } : c),
    );
  }, []);

  const addCustomCategory = useCallback((label: string, source: 'user' | 'ai_suggested' = 'user') => {
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setContentCategories((prev) => {
      if (prev.some((c) => c.category_key === key || c.name.toLowerCase() === label.toLowerCase())) return prev;
      return [...prev, { category_key: key, name: label, source, active: true }];
    });
  }, []);

  const fetchCatSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) { setCatSuggestions([]); return; }
    setCatSugLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sector,
          current_categories: contentCategories.map((c) => c.name),
          input:              value,
        }),
      });
      const json = await res.json();
      setCatSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch {
      setCatSuggestions([]);
    } finally {
      setCatSugLoading(false);
    }
  }, [sector, contentCategories]);

  const handleCatInputChange = useCallback((value: string) => {
    setCatInput(value);
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    catDebounceRef.current = setTimeout(() => { void fetchCatSuggestions(value); }, 500);
  }, [fetchCatSuggestions]);

  const dynamicQuestions = getDynamicQuestions(sector);

  function toggleSecondary(s: SocialSector) {
    if (s === sector) return;
    setSecondarySectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 2 ? [...prev, s] : prev,
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('El nombre del negocio es obligatorio'); return; }
    setSaving(true);
    try {
      // Save user name to Supabase auth metadata
      if (firstName.trim() || lastName.trim()) {
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
        creative:   'Estilo creativo y colorido: usa emojis, exclamaciones y texto dinámico.',
        elegant:    'Estilo elegante y minimal: sin emojis, frases cortas y muy sofisticadas.',
        warm:       'Estilo cálido y cercano: tono familiar, tuteo y mucha proximidad.',
        dynamic:    'Estilo dinámico y moderno: frases cortas, imperativas y mucha energía.',
        editorial:  'Estilo editorial y realista: storytelling auténtico, naturalidad y contexto.',
        dark:       'Estilo oscuro y premium: copywriting exclusivo, sin exclamaciones, muy sofisticado.',
        fresh:      'Estilo fresco y natural: tono orgánico, referencias a naturaleza y bienestar.',
        vintage:    'Estilo vintage y artesanal: lenguaje cálido, nostálgico, valorando el oficio.',
      };
      const res = await fetch('/api/brands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, sector, secondary_sectors: secondarySectors,
          visual_style: visualStyle, tone, hashtags: keywords,
          location: location ? `${location}, ${country}` : country || null, slogans: slogan ? [slogan] : [],
          publish_mode: publishMode,
          publish_frequency: FREQUENCY_BY_PLAN[selectedPlan],
          plan: selectedPlan,
          colors: { primary: effectivePrimaryColor, secondary: effectiveSecondaryColor, tertiary: effectiveTertiaryColor, accent: effectivePrimaryColor },
          promo_code_id: promoCodeId ?? undefined,
          rules: { forbiddenWords: forbidden, noPublishDays: [], noEmojis: visualStyle === 'elegant' || visualStyle === 'dark', noAutoReplyNegative: false, forbiddenTopics: [] },
          content_categories: contentCategories.filter((c) => c.active),
          brand_voice_doc: [
            `Negocio: ${name}. Sector: ${sector}.`,
            `Estilo visual: ${visualStyle}. ${styleInstructions[visualStyle]}`,
            `Tono de marca: ${tone}.`,
            extraContext,
            keywords.length > 0 ? `Palabras clave: ${keywords.join(', ')}.` : '',
            `Objetivo principal: ${objective}.`,
            location ? `Ubicación: ${location}.` : '',
          ].filter(Boolean).join(' '),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear el negocio');
      toast.success('¡Negocio configurado correctamente!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally { setSaving(false); }
  }

  const previewPosts    = sectorPostsFor(sector);
  const previewCaptions = SECTOR_CAPTIONS[sector] ?? DEFAULT_CAPTIONS;
  const selectedStyle   = VISUAL_STYLES.find((s) => s.value === visualStyle)!;
  const effectivePrimaryColor = hasCustomPalette ? primaryColor : INITIAL_PRIMARY_COLOR;
  const effectiveSecondaryColor = hasCustomPalette ? secondaryColor : INITIAL_SECONDARY_COLOR;
  const effectiveTertiaryColor = hasCustomPalette ? tertiaryColor : INITIAL_TERTIARY_COLOR;
  // Right-column preview for step 2 — 9 photos specific to the current
  // (sector, style) pair, so switching style actually changes the images.
  const step2PreviewImgs = getSectorPreviewImages(sector, visualStyle);

  // ─── Right column previews ─────────────────────────────────────────────────

  const rightStep1 = (
    <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'hidden' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>
        Ejemplos de posibles publicaciones
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
        {previewPosts.slice(0, 3).map((img, i) => (
          <MockPost key={i} img={img} caption={previewCaptions[i] ?? DEFAULT_CAPTIONS[i]} index={i} />
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '20px', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
        <div style={{ fontFamily: FONT, fontSize: '0.8rem', color: MUTED, lineHeight: 1.7 }}>
          NeuroPost adapta el tono, los hashtags y el tipo de contenido según tu sector. Puedes añadir un sector secundario con clic derecho.
        </div>
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

      {/* ── Left column ── */}
      <div style={{ width: '58%', background: BG_L, display: 'flex', flexDirection: 'column', padding: '44px 48px', overflowY: 'auto', flexShrink: 0 }}>

        {/* Logo */}
        <Link href="/" style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.2rem', color: INK, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 36, flexShrink: 0, textDecoration: 'none', cursor: 'pointer' }}>
          NeuroPost
        </Link>

        {/* Progress */}
        <div style={{ marginBottom: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            {([1,2,3,4,5] as Step[]).map((s) => (
              <div key={s} style={{ flex: 1, height: 2, background: s <= step ? INK : '#e5e7eb', transition: 'background 0.3s' }} />
            ))}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: FONT, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Paso {step} de 5
          </p>
        </div>

        {/* ── Step 1: Sector ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿De qué trata tu negocio?</SectionTitle>
            <StepSub>Elige tu sector principal. Clic derecho en otro sector para añadirlo como secundario.</StepSub>

            <div style={{ marginBottom: 24 }}>
              {SECTOR_GROUPS.map((group) => (
                <div key={group.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT, marginBottom: 10 }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {group.items.map((s) => {
                      const isPrimary   = sector === s.value;
                      const isSecondary = secondarySectors.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { if (isPrimary) return; if (isSecondary) { toggleSecondary(s.value); return; } setSector(s.value as SocialSector); setSecondarySectors([]); }}
                          onContextMenu={(e) => { e.preventDefault(); toggleSecondary(s.value as SocialSector); }}
                          style={{
                            position: 'relative', aspectRatio: '4 / 3',
                            overflow: 'hidden', border: `2px solid ${isPrimary ? ACCENT : isSecondary ? ACCENT : 'transparent'}`,
                            cursor: 'pointer', padding: 0, background: 'transparent',
                            outline: 'none', transition: 'border-color 0.2s, transform 0.15s',
                            transform: isPrimary ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isPrimary ? `0 0 0 4px rgba(15,118,110,0.15)` : 'none',
                          }}
                        >
                          <img src={s.img} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: isPrimary ? 'rgba(15,118,110,0.25)' : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%)' }} />
                          <div style={{ position: 'absolute', bottom: 6, left: 7, right: 7, fontFamily: FONT, fontWeight: 700, fontSize: '0.72rem', color: 'white', textAlign: 'left', lineHeight: 1.2 }}>
                            {s.label}
                          </div>
                          {isPrimary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>✓</div>
                          )}
                          {isSecondary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>+</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ position: 'sticky', bottom: 0, marginTop: 8, paddingTop: 16, paddingBottom: 4, background: `linear-gradient(to top, ${BG_L} 70%, transparent)` }}>
              <BtnPrimary onClick={() => setStep(2)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 2: Visual style ── */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿Cómo quieres que se vea?</SectionTitle>
            <StepSub>Elige la estética visual de tu feed. Define la edición, colores y tipo de contenido.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {VISUAL_STYLES.map((style) => {
                  const selected = visualStyle === style.value;
                  const cardImgs = getSectorStyleImages(sector, style.value);
                  return (
                    <button key={style.value} type="button" onClick={() => setVisualStyle(style.value)} style={{
                      padding: 0, overflow: 'hidden',
                      border: `2px solid ${selected ? ACCENT : '#e5e7eb'}`,
                      cursor: 'pointer', background: 'transparent', outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: selected ? `0 0 0 4px rgba(15,118,110,0.12)` : 'none',
                      position: 'relative',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        {cardImgs.map((img, i) => (
                          <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', background: '#f3f4f6' }} />
                        ))}
                      </div>
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: '0.8rem', color: INK, marginBottom: 2 }}>
                          {style.title}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: '0.65rem', color: MUTED }}>
                          {style.tag}
                        </div>
                      </div>
                      {selected && (
                        <div style={{ position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>✓</div>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <BtnBack onClick={() => setStep(1)} />
              <BtnPrimary onClick={() => setStep(3)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 3: Business details ── */}
        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SectionTitle>Cuéntanos sobre ti</SectionTitle>
            <StepSub>Para que NeuroPost adapte el contenido a tu negocio.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Personal name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label>Tu nombre *</Label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Ej: Ana"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>Apellidos</Label>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Ej: García López"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Business name (free text input — required) */}
                <div>
                  <Label>Nombre del negocio *</Label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Ej: Heladería La Nube"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Dynamic sector question — multi-select pills + free
                    "Otro" input. The user can pick several suggestions and
                    also add custom entries. */}
                {dynamicQuestions.map((q) => {
                  const options = SECTOR_SERVICE_OPTIONS[sector] ?? [];
                  const currentList = dynamicAnswers[q.key] ?? [];
                  // Split selected values into those matching suggestions vs.
                  // custom entries, so we can render custom entries as
                  // removable chips below the suggestion pills.
                  const custom = currentList.filter((v) => !options.includes(v));
                  const togglePill = (opt: string) =>
                    setDynamicAnswers((prev) => {
                      const list = prev[q.key] ?? [];
                      return list.includes(opt)
                        ? { ...prev, [q.key]: list.filter(x => x !== opt) }
                        : { ...prev, [q.key]: [...list, opt] };
                    });
                  const addCustom = (raw: string) => {
                    const value = raw.trim();
                    if (!value) return;
                    setDynamicAnswers((prev) => {
                      const list = prev[q.key] ?? [];
                      if (list.includes(value)) return prev;
                      return { ...prev, [q.key]: [...list, value] };
                    });
                  };
                  const removeCustom = (value: string) =>
                    setDynamicAnswers((prev) => ({
                      ...prev,
                      [q.key]: (prev[q.key] ?? []).filter(x => x !== value),
                    }));

                  return (
                    <div key={q.key}>
                      <Label>
                        {q.label}{' '}
                        <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>
                          (elige uno o varios)
                        </span>
                      </Label>

                      {/* Suggestion pills (only if the sector has suggestions) */}
                      {options.length > 0 && (
                        <PillGroup>
                          {options.map((opt) => (
                            <PillOption
                              key={opt}
                              active={currentList.includes(opt)}
                              onClick={() => togglePill(opt)}
                            >
                              {opt}
                            </PillOption>
                          ))}
                        </PillGroup>
                      )}

                      {/* Custom entries as removable chips */}
                      {custom.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {custom.map((value) => (
                            <span
                              key={value}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px 6px 12px',
                                background: '#0F766E',
                                color: '#ffffff',
                                fontFamily: FONT,
                                fontSize: '0.82rem',
                                fontWeight: 700,
                              }}
                            >
                              {value}
                              <button
                                type="button"
                                onClick={() => removeCustom(value)}
                                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                                aria-label={`Quitar ${value}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Free-text "Otro" input — Enter adds, comma separates */}
                      <input
                        style={{ ...inputStyle, marginTop: 10 }}
                        type="text"
                        placeholder={options.length ? `Otro: ${q.placeholder} (pulsa Enter)` : `${q.placeholder} (pulsa Enter)`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = e.target as HTMLInputElement;
                            // Support comma-separated entries
                            target.value.split(',').map(s => s.trim()).filter(Boolean).forEach(addCustom);
                            target.value = '';
                          }
                        }}
                        onBlur={(e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.value.trim()) {
                            target.value.split(',').map(s => s.trim()).filter(Boolean).forEach(addCustom);
                            target.value = '';
                          }
                        }}
                      />
                    </div>
                  );
                })}

                {/* ── Content categories ── */}
                <div>
                  <Label>
                    Categorías de contenido{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>
                      (activa las que quieras publicar)
                    </span>
                  </Label>
                  <p style={{ fontFamily: FONT, fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                    {contentCategories.length > 0
                      ? 'Estas son las categorías recomendadas para tu sector. Desactiva las que no te interesen.'
                      : 'Añade las categorías de contenido que quieras publicar.'}
                  </p>

                  {/* Template + custom chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {contentCategories.map((cat) => (
                      <button
                        key={cat.category_key}
                        type="button"
                        onClick={() => toggleCategory(cat.category_key)}
                        style={{
                          padding:     '7px 12px',
                          background:  cat.active ? ACCENT : '#ffffff',
                          color:       cat.active ? '#ffffff' : '#374151',
                          border:      `1.5px solid ${cat.active ? ACCENT : BORDER}`,
                          cursor:      'pointer',
                          fontFamily:  FONT,
                          fontSize:    '0.78rem',
                          fontWeight:  700,
                          borderRadius: 0,
                          display:     'inline-flex',
                          alignItems:  'center',
                          gap:         5,
                          opacity:     cat.active ? 1 : 0.55,
                          transition:  'all 0.15s',
                        }}
                      >
                        {cat.name}
                        {cat.source === 'ai_suggested' && (
                          <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 400, color: cat.active ? 'rgba(255,255,255,0.8)' : ACCENT }}>
                            ✦ IA
                          </span>
                        )}
                        {cat.source === 'user' && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); setContentCategories((prev) => prev.filter((c) => c.category_key !== cat.category_key)); }}
                            style={{ cursor: 'pointer', fontSize: 12, lineHeight: 1, color: cat.active ? 'rgba(255,255,255,0.7)' : MUTED }}
                            aria-label={`Eliminar ${cat.name}`}
                          >
                            ×
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Free-text input + AI autocomplete */}
                  <div style={{ position: 'relative' }}>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="Añadir categoría… (ej: sorteos, behind the scenes, UGC)"
                      value={catInput}
                      onChange={(e) => handleCatInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && catInput.trim()) {
                          e.preventDefault();
                          addCustomCategory(catInput.trim(), 'user');
                          setCatInput('');
                          setCatSuggestions([]);
                        }
                        if (e.key === 'Escape') { setCatSuggestions([]); }
                      }}
                    />
                    {/* AI suggestions dropdown */}
                    {(catSuggestions.length > 0 || catSugLoading) && (
                      <div style={{
                        position:   'absolute', top: '100%', left: 0, right: 0,
                        background: '#ffffff', border: `1px solid ${BORDER}`,
                        borderTop:  'none', zIndex: 20,
                        boxShadow:  '0 4px 12px rgba(0,0,0,0.08)',
                      }}>
                        {catSugLoading && (
                          <div style={{ padding: '10px 14px', fontFamily: FONT, fontSize: 12, color: MUTED }}>
                            Buscando sugerencias…
                          </div>
                        )}
                        {catSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              addCustomCategory(s, 'ai_suggested');
                              setCatInput('');
                              setCatSuggestions([]);
                            }}
                            style={{
                              display:    'flex', alignItems: 'center', justifyContent: 'space-between',
                              width:      '100%', padding: '9px 14px',
                              background: 'transparent', border: 'none',
                              cursor:     'pointer', fontFamily: FONT,
                              fontSize:   13, color: INK, textAlign: 'left',
                              borderBottom: `1px solid #f3f4f6`,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdfa')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>{s}</span>
                            <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>✦ IA</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Country — native dropdown grouped by region */}
                <div>
                  <Label>País</Label>
                  <select
                    style={selectStyle}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {COUNTRY_GROUPS.map((g) => (
                      <optgroup key={g.region} label={g.region}>
                        {g.countries.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Region / Autonomous community — free text input */}
                <div>
                  <Label>
                    {country === 'España' ? 'Comunidad autónoma' : 'Región / Ciudad'}{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
                  </Label>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder={country === 'España' ? 'Ej: Cataluña, Madrid, Andalucía...' : 'Ej: Ciudad de México, Buenos Aires...'}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {/* Optional brand palette — shown here in step 3 so the
                    preview card on the right reflects the chosen colors. */}
                <div style={{ paddingTop: 6 }}>
                  <Label>
                    ¿Tienes una paleta propia?{' '}
                    <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>
                      (opcional)
                    </span>
                  </Label>
                  <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
                    Si tu negocio ya tiene colores de marca, elígelos aquí.
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Principal', value: primaryColor, set: setPrimaryColor },
                      { label: 'Secundario', value: secondaryColor, set: setSecondaryColor },
                      { label: 'Terciario', value: tertiaryColor, set: setTertiaryColor },
                    ].map((c) => {
                      const colorInputId = `brand-color-${c.label.toLowerCase().replace(/\s+/g, '-')}`;
                      return (
                        <div key={c.label} className="brandColorPicker" style={{ opacity: hasCustomPalette ? 1 : 0.45 }}>
                          <input
                            id={colorInputId}
                            type="color"
                            value={c.value}
                            onChange={(e) => c.set(e.target.value)}
                            className="brandColorInput"
                            disabled={!hasCustomPalette}
                            title={`Seleccionar color ${c.label.toLowerCase()}`}
                            aria-label={`Color ${c.label.toLowerCase()}`}
                          />
                          <label htmlFor={colorInputId} className="brandColorLabel">{c.label}</label>
                        </div>
                      );
                    })}
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: FONT,
                        fontSize: '0.78rem',
                        color: MUTED,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hasCustomPalette}
                        onChange={(e) => setHasCustomPalette(!e.target.checked)}
                      />
                      Sin paleta propia
                    </label>
                  </div>
                  {!hasCustomPalette && (
                    <div style={{ fontFamily: FONT, fontSize: '0.74rem', color: MUTED, marginTop: 10 }}>
                      Se aplicará tu paleta inicial: {INITIAL_PRIMARY_COLOR} · {INITIAL_SECONDARY_COLOR} · {INITIAL_TERTIARY_COLOR}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <BtnBack onClick={() => setStep(2)} />
              <BtnPrimary onClick={() => { if (!name.trim()) { toast.error('El nombre es obligatorio'); return; } setStep(4); }}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 4: Brand voice + publish mode ── */}
        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SectionTitle>Tu voz de marca</SectionTitle>
            <StepSub>Elige cómo quieres comunicarte y cómo gestionamos las publicaciones.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 20 }}>
              <div>
                <Label>Tono de comunicación</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TONE_OPTIONS.map((t) => (
                    <button key={t.value} type="button" onClick={() => setTone(t.value)} style={{
                      padding: '14px', borderRadius: 0, cursor: 'pointer', textAlign: 'left',
                      border: `1.5px solid ${tone === t.value ? ACCENT : '#e5e7eb'}`,
                      background: tone === t.value ? 'rgba(15,118,110,0.1)' : '#ffffff',
                      outline: 'none', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: '0.88rem', color: tone === t.value ? INK : '#6b7280' }}>{t.label}</div>
                        {tone === t.value && <div style={{ width: 16, height: 16, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'white', fontWeight: 900, flexShrink: 0 }}>✓</div>}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: '0.72rem', color: MUTED }}>{t.desc}</div>
                      <div style={{ marginTop: 6, fontFamily: FONT, fontSize: '0.7rem', color: tone === t.value ? '#6b7280' : '#d1d5db', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                        &ldquo;{toneExamples[t.value]}&rdquo;
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>
                  Palabras clave{' '}
                  <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>
                    (elige las que encajan o escribe las tuyas)
                  </span>
                </Label>
                {(() => {
                  const suggestions = SECTOR_KEYWORD_SUGGESTIONS[sector]
                    ?? ['artesanal', 'local', 'calidad', 'sostenible', 'profesional', 'exclusivo', 'fresco', 'auténtico'];
                  const customKeywords = keywords.filter((kw) => !suggestions.includes(kw));
                  return (
                    <>
                      {/* Suggestion pills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                        {suggestions.map((kw) => {
                          const active = keywords.includes(kw);
                          return (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => active ? removeTag(keywords, setKeywords, kw) : addTag(keywords, setKeywords, kw)}
                              style={{
                                padding: '7px 14px', borderRadius: 0, cursor: 'pointer',
                                fontFamily: FONT, fontSize: '0.82rem', fontWeight: 700,
                                border: `1.5px solid ${active ? ACCENT : '#e5e7eb'}`,
                                background: active ? ACCENT : '#f3f4f6',
                                color: active ? 'white' : '#6b7280',
                                transition: 'all 0.15s', outline: 'none',
                              }}
                            >
                              {kw}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom keywords added by the user shown as removable chips */}
                      {customKeywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {customKeywords.map((kw) => (
                            <span
                              key={kw}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 10px 6px 12px',
                                background: ACCENT,
                                color: '#ffffff',
                                fontFamily: FONT,
                                fontSize: '0.82rem',
                                fontWeight: 700,
                              }}
                            >
                              {kw}
                              <button
                                type="button"
                                onClick={() => removeTag(keywords, setKeywords, kw)}
                                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                                aria-label={`Quitar ${kw}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Free-text input — Enter adds, comma/space separates */}
                      <input
                        style={{ ...inputStyle, marginTop: 10 }}
                        type="text"
                        placeholder="Otra palabra clave (pulsa Enter)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const target = e.target as HTMLInputElement;
                            target.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).forEach((kw) => {
                              if (!keywords.includes(kw)) addTag(keywords, setKeywords, kw);
                            });
                            target.value = '';
                          }
                        }}
                        onBlur={(e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.value.trim()) {
                            target.value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).forEach((kw) => {
                              if (!keywords.includes(kw)) addTag(keywords, setKeywords, kw);
                            });
                            target.value = '';
                          }
                        }}
                      />
                    </>
                  );
                })()}
              </div>

              {/* Publish mode — moved here from the old step 5. Frequency is
                  derived from the selected plan later, so we only ask how much
                  control the user wants over approvals. */}
              <div>
                <Label>Modo de publicación</Label>
                <div style={{ fontFamily: FONT, fontSize: '0.78rem', color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
                  ¿Cómo quieres que gestionemos tu contenido?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {PUBLISH_MODE_OPTIONS.map((m) => {
                    const active = publishMode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPublishMode(m.value)}
                        style={{
                          position: 'relative',
                          padding: '16px 14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          border: `1.5px solid ${active ? ACCENT : '#e5e7eb'}`,
                          background: active ? 'rgba(15,118,110,0.08)' : '#ffffff',
                          outline: 'none',
                          transition: 'all 0.15s',
                          boxShadow: active ? `0 0 0 3px rgba(15,118,110,0.1)` : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONT_C, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: active ? INK : '#374151' }}>
                            {m.label}
                          </span>
                          {m.value === 'semi' && (
                            <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: ACCENT, background: '#f0fdf4', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Recomendado
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED, lineHeight: 1.45 }}>
                          {m.desc}
                        </div>
                        {active && (
                          <span style={{ color: ACCENT, fontWeight: 900, fontSize: 14, marginTop: 2 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <BtnBack onClick={() => setStep(3)} />
              <BtnPrimary onClick={() => setStep(5)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

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

      {/* ── Right column ── */}
      <div style={{ flex: 1, background: BG_R, borderLeft: `1px solid ${BORDER}`, overflowY: 'auto' }}>
        {rightContent}
      </div>

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
