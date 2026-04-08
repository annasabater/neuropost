'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { SocialSector, BrandTone, PublishMode, PostGoal, VisualStyle } from '@/types';
import { TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { useTagInput } from '@/hooks/useTagInput';
import CouponInput from '@/components/billing/CouponInput';

// ─── Unsplash helper ──────────────────────────────────────────────────────────

const UNS = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ─── Sector data with images ──────────────────────────────────────────────────

type SectorItem = { value: SocialSector; label: string; img: string };
type SectorGroup = { group: string; items: SectorItem[] };

const SECTOR_GROUPS: SectorGroup[] = [
  { group: 'Comida y Bebida', items: [
    { value: 'restaurante', label: 'Gastronomía',        img: UNS('1517248135467-4c7edcad34c4') },
    { value: 'heladeria',   label: 'Heladería',           img: UNS('1563805042-7684c019e1cb') },
    { value: 'cafeteria',   label: 'Cafetería / Brunch', img: UNS('1501339847302-ac426a4a7cbb') },
    { value: 'cocteleria',  label: 'Cócteles / Bar',     img: UNS('1514362545857-3bc16c4c7d1b') },
    { value: 'street_food', label: 'Street Food',        img: UNS('1565299624946-b28f40a0ae38') },
    { value: 'vinoteca',    label: 'Vinoteca',           img: UNS('1510812431401-41d2bd2722f3') },
    { value: 'panaderia',   label: 'Panadería',          img: UNS('1509440159596-0249088772ff') },
  ]},
  { group: 'Belleza y Estética', items: [
    { value: 'barberia',   label: 'Barbería',    img: UNS('1503951914875-452162b0f3f1') },
    { value: 'nail_art',   label: 'Nail Art',    img: UNS('1604654894610-df63bc536371') },
    { value: 'estetica',   label: 'Centro Spa',  img: UNS('1540555700478-4be289fbecef') },
    { value: 'maquillaje', label: 'Cosmética',   img: UNS('1522335789203-aabd1fc54bc9') },
  ]},
  { group: 'Moda y Estilo', items: [
    { value: 'boutique',    label: 'Boutique',    img: UNS('1441984904996-e0b6ba687e04') },
    { value: 'moda_hombre', label: 'Moda Hombre', img: UNS('1507003211169-0a1dd7228f2d') },
    { value: 'zapateria',   label: 'Zapatería',   img: UNS('1542291026-7eec264c27ff') },
    { value: 'skincare',    label: 'Skincare',    img: UNS('1556228578-8c89e6adf883') },
  ]},
  { group: 'Salud y Bienestar', items: [
    { value: 'gym',       label: 'Gimnasio / Fitness', img: UNS('1534438327276-14e5300c3a48') },
    { value: 'yoga',      label: 'Yoga / Pilates',     img: UNS('1571019614242-c5c5dee9f50b') },
    { value: 'dental',    label: 'Clínica Dental',     img: UNS('1559757148-5c350d0d3c56') },
    { value: 'clinica',   label: 'Clínica / Medicina', img: UNS('1519494026892-80bbd2d6fd0d') },
    { value: 'nutricion', label: 'Nutrición',          img: UNS('1512621776951-a57141f2eefd') },
  ]},
  { group: 'Hogar y Servicios', items: [
    { value: 'decoracion',  label: 'Decoración',   img: UNS('1555041469-dd5e56068b4d') },
    { value: 'jardineria',  label: 'Jardinería',   img: UNS('1416879595882-3373a0480b5b') },
    { value: 'reformas',    label: 'Reformas',     img: UNS('1504307651254-35680f356dfd') },
    { value: 'inmobiliaria',label: 'Inmobiliaria', img: UNS('1560518883-ce09059eeffa') },
    { value: 'fotografia',  label: 'Fotografía',   img: UNS('1516035069371-29a1b244cc32') },
    { value: 'floristeria', label: 'Floristería',  img: UNS('1487530811576-3780949e7b0b') },
    { value: 'otro',        label: 'Otro negocio', img: UNS('1497366216548-37526070297c') },
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
  { value: 'editorial', title: 'Editorial y Realista', tag: 'Natural · Documental · Auténtico',
    palette: ['#F4EBD0','#8A9E8A','#C4A882','#5C5C5C'] },
  { value: 'dark', title: 'Oscuro y Premium', tag: 'Exclusivo · Lujoso · Impactante',
    palette: ['#0D0D0D','#2C1810','#6B4C3B','#C4A882'] },
  { value: 'fresh', title: 'Fresco y Natural', tag: 'Orgánico · Saludable · Luminoso',
    palette: ['#C8E6C9','#81C784','#388E3C','#F1F8E9'] },
  { value: 'vintage', title: 'Vintage y Artesanal', tag: 'Nostálgico · Cálido · Artesano',
    palette: ['#C4956A','#8B6914','#D4B896','#5C4B3A'] },
];

// ─── CSS filters per visual style ────────────────────────────────────────────

const STYLE_FILTERS: Record<VisualStyle, string> = {
  creative:  'saturate(1.5) brightness(1.05)',
  elegant:   'saturate(0.25) brightness(1.1)',
  warm:      'saturate(0.95) brightness(1.02)',
  dynamic:   'contrast(1.25) saturate(1.35)',
  editorial: 'sepia(0.1) brightness(1.05)',
  dark:      'brightness(0.65) contrast(1.3) saturate(0.8)',
  fresh:     'saturate(0.9) brightness(1.12) hue-rotate(-5deg)',
  vintage:   'sepia(0.45) saturate(0.75) brightness(0.9)',
};

// ─── Sector-aware visual images ──────────────────────────────────────────────
// Builds a bank of 12 images relevant to the selected sector, used in step 2

function getSectorVisualImages(sector: SocialSector): string[] {
  const posts = [...(SECTOR_POSTS[sector] ?? DEFAULT_POSTS)];

  // Add sector thumbnail from SECTOR_GROUPS
  const sectorItem = SECTOR_GROUPS.flatMap(g => g.items).find(i => i.value === sector);
  if (sectorItem && !posts.includes(sectorItem.img)) posts.push(sectorItem.img);

  // Add images from same sector group category
  const sameGroup = SECTOR_GROUPS.find(g => g.items.some(i => i.value === sector));
  if (sameGroup) {
    for (const item of sameGroup.items) {
      if (item.value !== sector && !posts.includes(item.img) && posts.length < 12) {
        posts.push(item.img);
      }
      // Also add sector posts from sibling sectors
      const siblingPosts = SECTOR_POSTS[item.value];
      if (siblingPosts) {
        for (const sp of siblingPosts) {
          if (!posts.includes(sp) && posts.length < 12) posts.push(sp);
        }
      }
    }
  }

  // Pad to 12 by cycling
  const base = [...posts];
  while (posts.length < 12) posts.push(base[posts.length % base.length]);
  return posts;
}

// ─── Preview post images per sector ──────────────────────────────────────────

const SECTOR_POSTS: Partial<Record<SocialSector, string[]>> = {
  restaurante:  [UNS('1565299624946-b28f40a0ae38',300), UNS('1482049016688-2d3e1b311543',300), UNS('1567306226416-28f0efdc88ce',300)],
  heladeria:    [UNS('1563805042-7684c019e1cb',300), UNS('1570145820259-b5b80c5c8bd6',300), UNS('1497034825429-c343d7c6a68f',300)],
  cafeteria:    [UNS('1501339847302-ac426a4a7cbb',300), UNS('1495474472287-4d71bcdd2085',300), UNS('1521017432531-fbd92d768814',300)],
  gym:          [UNS('1534438327276-14e5300c3a48',300), UNS('1571019614242-c5c5dee9f50b',300), UNS('1517963879433-6ad2a56fcd15',300)],
  barberia:     [UNS('1503951914875-452162b0f3f1',300), UNS('1508214751196-c5bf6f5e2751',300), UNS('1560066984-138dadb4c305',300)],
  boutique:     [UNS('1441984904996-e0b6ba687e04',300), UNS('1507003211169-0a1dd7228f2d',300), UNS('1558618666-fcd25c85cd64',300)],
  inmobiliaria: [UNS('1560518883-ce09059eeffa',300), UNS('1570129477492-45c003edd2be',300), UNS('1582653291997-79a4f2b7d9a7',300)],
  floristeria:  [UNS('1487530811576-3780949e7b0b',300), UNS('1499444819541-60e4a698ecf5',300), UNS('1439127989242-9da695f9ca26',300)],
  yoga:         [UNS('1571019614242-c5c5dee9f50b',300), UNS('1506126613408-eca07ce68773',300), UNS('1544367654-00eb648f0b1f',300)],
  cocteleria:   [UNS('1514362545857-3bc16c4c7d1b',300), UNS('1510812431401-41d2bd2722f3',300), UNS('1517248135467-4c7edcad34c4',300)],
  street_food:  [UNS('1565299624946-b28f40a0ae38',300), UNS('1567306226416-28f0efdc88ce',300), UNS('1482049016688-2d3e1b311543',300)],
  vinoteca:     [UNS('1510812431401-41d2bd2722f3',300), UNS('1514362545857-3bc16c4c7d1b',300), UNS('1517248135467-4c7edcad34c4',300)],
  panaderia:    [UNS('1509440159596-0249088772ff',300), UNS('1501339847302-ac426a4a7cbb',300), UNS('1495474472287-4d71bcdd2085',300)],
  nail_art:     [UNS('1604654894610-df63bc536371',300), UNS('1522335789203-aabd1fc54bc9',300), UNS('1540555700478-4be289fbecef',300)],
  estetica:     [UNS('1540555700478-4be289fbecef',300), UNS('1604654894610-df63bc536371',300), UNS('1556228578-8c89e6adf883',300)],
  maquillaje:   [UNS('1522335789203-aabd1fc54bc9',300), UNS('1604654894610-df63bc536371',300), UNS('1556228578-8c89e6adf883',300)],
  moda_hombre:  [UNS('1507003211169-0a1dd7228f2d',300), UNS('1441984904996-e0b6ba687e04',300), UNS('1542291026-7eec264c27ff',300)],
  zapateria:    [UNS('1542291026-7eec264c27ff',300), UNS('1507003211169-0a1dd7228f2d',300), UNS('1441984904996-e0b6ba687e04',300)],
  skincare:     [UNS('1556228578-8c89e6adf883',300), UNS('1540555700478-4be289fbecef',300), UNS('1522335789203-aabd1fc54bc9',300)],
  dental:       [UNS('1559757148-5c350d0d3c56',300), UNS('1519494026892-80bbd2d6fd0d',300), UNS('1512621776951-a57141f2eefd',300)],
  clinica:      [UNS('1519494026892-80bbd2d6fd0d',300), UNS('1559757148-5c350d0d3c56',300), UNS('1512621776951-a57141f2eefd',300)],
  nutricion:    [UNS('1512621776951-a57141f2eefd',300), UNS('1571019614242-c5c5dee9f50b',300), UNS('1519494026892-80bbd2d6fd0d',300)],
  decoracion:   [UNS('1555041469-dd5e56068b4d',300), UNS('1504307651254-35680f356dfd',300), UNS('1416879595882-3373a0480b5b',300)],
  jardineria:   [UNS('1416879595882-3373a0480b5b',300), UNS('1487530811576-3780949e7b0b',300), UNS('1439127989242-9da695f9ca26',300)],
  reformas:     [UNS('1504307651254-35680f356dfd',300), UNS('1555041469-dd5e56068b4d',300), UNS('1560518883-ce09059eeffa',300)],
  fotografia:   [UNS('1516035069371-29a1b244cc32',300), UNS('1506126613408-eca07ce68773',300), UNS('1544367654-00eb648f0b1f',300)],
};
const DEFAULT_POSTS = [UNS('1482049016688-2d3e1b311543',300), UNS('1558618666-fcd25c85cd64',300), UNS('1570129477492-45c003edd2be',300)];

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

const CITY_OPTIONS = [
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia',
  'Palma de Mallorca', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba', 'Valladolid',
  'Vigo', 'Gijón', 'Granada', 'San Sebastián', 'A Coruña', 'Vitoria-Gasteiz',
  'Oviedo', 'Pamplona', 'Santa Cruz de Tenerife', 'Santander', 'Almería',
  'Burgos', 'Castellón', 'Salamanca', 'Logroño', 'Marbella', 'Jerez de la Frontera',
  'Toledo', 'Albacete', 'León', 'Huelva', 'Tarragona', 'Lleida', 'Badajoz',
  'Badalona', 'Terrassa', 'Sabadell', 'Getafe', 'Leganés', 'Móstoles',
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

// ─── Step 5 publish mode images ───────────────────────────────────────────────

const PUBLISH_MODE_IMGS: Record<PublishMode, string> = {
  manual: UNS('1551434678-e0ef8e06e461', 800),
  semi:   UNS('1460925895917-afdab827c52f', 800),
  auto:   UNS('1485827404703-89b55fcc595e', 800),
};

// ─── Shared design tokens ─────────────────────────────────────────────────────

const ACCENT = '#ff5c1a';
const BG_L   = '#0f0e0c';
const BG_R   = '#141720';
const INK    = '#e8edf8';
const MUTED  = 'rgba(232,237,248,0.4)';
const BORDER = 'rgba(255,255,255,0.08)';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, color: INK,
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontSize: '0.9rem', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '12px 36px 12px 16px',
  background: '#1a1e2d',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, color: INK,
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontSize: '0.9rem', outline: 'none', cursor: 'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7a99' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.55rem', color: INK, letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.15 }}>
      {children}
    </div>
  );
}

function StepSub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.88rem', color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function BtnPrimary({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '13px 28px', borderRadius: 40,
      background: disabled ? 'rgba(255,255,255,0.1)' : ACCENT,
      color: 'white', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.9rem',
      display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
    }}>
      {children}
    </button>
  );
}

function BtnBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '13px 20px', borderRadius: 40,
      background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
      color: MUTED, cursor: 'pointer',
      fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem',
      transition: 'all 0.2s',
    }}>
      ← Atrás
    </button>
  );
}

function MockPost({ img, caption, index }: { img: string; caption: string; index: number }) {
  const handles = ['@tunegocio', '@tunegocio', '@tunegocio'];
  const likes   = [234, 189, 312];
  const comms   = [18, 24, 9];
  return (
    <div style={{
      background: '#1a1d2e', borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, width: 200,
    }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)`, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.75rem', fontWeight: 700, color: INK }}>{handles[index]}</span>
      </div>
      <img src={img} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '0.78rem', color: MUTED }}>♥ {likes[index]}</span>
          <span style={{ fontSize: '0.78rem', color: MUTED }}>💬 {comms[index]}</span>
        </div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.75rem', color: INK, lineHeight: 1.5 }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();
  const [step,   setStep]   = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [sector,           setSector]           = useState<SocialSector>('restaurante');
  const [secondarySectors, setSecondarySectors] = useState<SocialSector[]>([]);
  const [visualStyle,      setVisualStyle]      = useState<VisualStyle>('warm');
  const [name,             setName]             = useState('');
  const [location,         setLocation]         = useState('');
  const [slogan,           setSlogan]           = useState('');
  const [dynamicAnswers,   setDynamicAnswers]   = useState<Record<string, string>>({});
  const [tone,             setTone]             = useState<BrandTone>('cercano');
  const [keywords,         setKeywords]         = useState<string[]>([]);
  const [kwInput,          setKwInput]          = useState('');
  const [forbidden,        setForbidden]        = useState<string[]>([]);
  const [fbInput,          setFbInput]          = useState('');
  const [objective]                             = useState<PostGoal>('engagement');
  const [publishMode,      setPublishMode]      = useState<PublishMode>('manual');
  const [publishFrequency, setPublishFrequency] = useState<2 | 5 | 7>(5);
  const [locationDropdown, setLocationDropdown] = useState('');
  const [primaryColor,     setPrimaryColor]     = useState('#FF6B35');
  const [secondaryColor,   setSecondaryColor]   = useState('#1A1A2E');
  const [promoCodeId,      setPromoCodeId]      = useState<string | null>(null);
  const [discountText,     setDiscountText]     = useState('');

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
      const extraContext = dynamicQuestions
        .map((q) => `${q.label}: ${dynamicAnswers[q.key] ?? ''}`)
        .filter((l) => !l.endsWith(': ')).join('. ');
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
          location: location || null, slogans: slogan ? [slogan] : [],
          publish_mode: publishMode,
          publish_frequency: publishFrequency,
          colors: { primary: primaryColor, secondary: secondaryColor, accent: primaryColor },
          promo_code_id: promoCodeId ?? undefined,
          rules: { forbiddenWords: forbidden, noPublishDays: [], noEmojis: visualStyle === 'elegant' || visualStyle === 'dark', noAutoReplyNegative: false, forbiddenTopics: [] },
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

  const previewPosts    = SECTOR_POSTS[sector] ?? DEFAULT_POSTS;
  const previewCaptions = SECTOR_CAPTIONS[sector] ?? DEFAULT_CAPTIONS;
  const selectedStyle   = VISUAL_STYLES.find((s) => s.value === visualStyle)!;
  const sectorVisualImgs = getSectorVisualImages(sector);

  // ─── Right column previews ─────────────────────────────────────────────────

  const rightStep1 = (
    <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 8 }}>
        Así quedará tu feed
      </div>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {previewPosts.map((img, i) => (
          <MockPost key={i} img={img} caption={previewCaptions[i] ?? DEFAULT_CAPTIONS[i]} index={i} />
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.8rem', color: MUTED, lineHeight: 1.7 }}>
          NeuroPost adapta el tono, los hashtags y el tipo de contenido según tu sector. Puedes añadir un sector secundario con clic derecho.
        </div>
      </div>
    </div>
  );

  const rightStep2 = (
    <div style={{ padding: '48px 40px', height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 16 }}>
        Preview de tu feed
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, borderRadius: 12, overflow: 'hidden' }}>
        {sectorVisualImgs.slice(0, 9).map((img: string, i: number) => (
          <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', filter: STYLE_FILTERS[visualStyle] }} />
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
        {selectedStyle.palette.map((c) => (
          <div key={c} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />
        ))}
      </div>
      <div style={{ marginTop: 8, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', color: MUTED }}>
        Paleta de colores · {selectedStyle.tag}
      </div>
    </div>
  );

  const rightStep3 = (
    <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Tu tarjeta de negocio
      </div>
      <div style={{ background: '#1a1d2e', borderRadius: 18, padding: '32px', border: '1px solid rgba(255,255,255,0.08)', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {name ? name[0].toUpperCase() : 'N'}
        </div>
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.4rem', color: INK, letterSpacing: '-0.03em' }}>
            {name || 'Tu negocio'}
          </div>
          {location && <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', color: MUTED, marginTop: 2 }}>{location}</div>}
        </div>
        {slogan && (
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontStyle: 'italic', fontSize: '0.9rem', color: 'rgba(232,237,248,0.6)', borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12 }}>
            &ldquo;{slogan}&rdquo;
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(255,92,26,0.15)', color: ACCENT, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 40, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sector}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.07)', color: MUTED, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 40 }}>
            {visualStyle}
          </span>
        </div>
      </div>
    </div>
  );

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
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 16 }}>
        Ejemplo de post con tu tono
      </div>
      <div style={{ background: '#1a1d2e', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)` }} />
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.82rem', fontWeight: 700, color: INK }}>{name || 'tunegocio'}</div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.7rem', color: MUTED }}>hace 2h</div>
          </div>
        </div>
        <img src={previewPosts[0]} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: '14px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', color: INK, lineHeight: 1.6, marginBottom: 8 }}>
            {toneExamples[tone]}
          </div>
          {keywords.length > 0 && (
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.8rem', color: '#818cf8' }}>
              {keywords.slice(0, 3).map((k) => `#${k}`).join(' ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const modeDescriptions: Record<PublishMode, string> = {
    manual: 'Recibirás propuestas de contenido. Tú decides qué publicar y cuándo.',
    semi:   'Preparamos el contenido y te lo enviamos para aprobación. Un clic y publicamos.',
    auto:   'Publicamos de forma autónoma según tu estrategia. Tú revisas los resultados.',
  };

  const modeSteps: Record<PublishMode, string[]> = {
    manual:   ['IA genera propuestas de contenido', 'Tú revisas y decides qué publicar', 'Publicamos en Instagram y Facebook'],
    semi:     ['IA crea y programa el contenido', 'Te enviamos una notificación para aprobar', 'Un clic y publicamos automáticamente'],
    auto:     ['IA crea contenido según tu estrategia', 'Publicamos sin interrupciones', 'Recibes informes semanales de resultados'],
  };

  const rightStep5 = (
    <div style={{ padding: '48px 40px', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Cómo funciona
      </div>
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        <img src={PUBLISH_MODE_IMGS[publishMode]} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
        <div style={{ background: '#1a1d2e', padding: 24 }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: 8 }}>
            {PUBLISH_MODE_OPTIONS.find((m) => m.value === publishMode)?.label}
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
            {modeDescriptions[publishMode]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {modeSteps[publishMode].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `rgba(255,92,26,${0.3 + i * 0.2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: ACCENT, fontFamily: "'Cabinet Grotesk', sans-serif", flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.83rem', color: INK }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,92,26,0.08)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.8rem', color: ACCENT }}>{publishFrequency}</div>
            <div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', fontWeight: 700, color: INK }}>posts por semana</div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', color: MUTED, marginTop: 1 }}>≈ {publishFrequency * 4} publicaciones al mes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const rightContent = [rightStep1, rightStep2, rightStep3, rightStep4, rightStep5][step - 1];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="onboarding-page" style={{ position: 'fixed', inset: 0, display: 'flex', zIndex: 50, overflow: 'hidden' }}>

      {/* ── Left column ── */}
      <div style={{ width: '42%', background: BG_L, display: 'flex', flexDirection: 'column', padding: '44px 44px', overflowY: 'auto', flexShrink: 0 }}>

        {/* Logo */}
        <Link href="/" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.3rem', color: INK, letterSpacing: '-0.04em', marginBottom: 36, flexShrink: 0, textDecoration: 'none', cursor: 'pointer' }}>
          NeuroPost
        </Link>

        {/* Progress */}
        <div style={{ marginBottom: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {([1,2,3,4,5] as Step[]).map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? ACCENT : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: MUTED, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: '0.06em' }}>
            PASO {step} DE 5
          </p>
        </div>

        {/* ── Step 1: Sector ── */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿De qué trata tu negocio?</SectionTitle>
            <StepSub>Elige tu sector principal. Clic derecho en otro sector para añadirlo como secundario.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24 }}>
              {SECTOR_GROUPS.map((group) => (
                <div key={group.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 10 }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
                            position: 'relative', height: 80, borderRadius: 10,
                            overflow: 'hidden', border: `2px solid ${isPrimary ? ACCENT : isSecondary ? '#059669' : 'transparent'}`,
                            cursor: 'pointer', padding: 0, background: 'transparent',
                            outline: 'none', transition: 'border-color 0.2s, transform 0.15s',
                            transform: isPrimary ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isPrimary ? `0 0 0 4px rgba(255,92,26,0.15)` : 'none',
                          }}
                        >
                          <img src={s.img} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: isPrimary ? 'rgba(255,92,26,0.25)' : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%)' }} />
                          <div style={{ position: 'absolute', bottom: 6, left: 7, right: 7, fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.72rem', color: 'white', textAlign: 'left', lineHeight: 1.2 }}>
                            {s.label}
                          </div>
                          {isPrimary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>✓</div>
                          )}
                          {isSecondary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>+</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <BtnPrimary onClick={() => setStep(2)}>Siguiente →</BtnPrimary>
          </div>
        )}

        {/* ── Step 2: Visual style ── */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿Cómo quieres que se vea?</SectionTitle>
            <StepSub>Elige la estética visual de tu feed. Define la edición, colores y tipo de contenido.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {VISUAL_STYLES.map((style, styleIdx) => {
                  const selected = visualStyle === style.value;
                  const cardImgs = [0, 1, 2, 3].map(i => sectorVisualImgs[(styleIdx * 2 + i) % sectorVisualImgs.length]);
                  return (
                    <button key={style.value} type="button" onClick={() => setVisualStyle(style.value)} style={{
                      padding: 0, borderRadius: 12, overflow: 'hidden',
                      border: `2px solid ${selected ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer', background: 'transparent', outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: selected ? `0 0 0 4px rgba(255,92,26,0.12)` : 'none',
                      position: 'relative',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        {cardImgs.map((img, i) => (
                          <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', filter: STYLE_FILTERS[style.value] }} />
                        ))}
                      </div>
                      <div style={{ background: '#1a1d2e', padding: '9px 11px' }}>
                        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.8rem', color: INK, marginBottom: 2 }}>
                          {style.title}
                        </div>
                        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.65rem', color: MUTED }}>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Cuéntanos sobre ti</SectionTitle>
            <StepSub>Para que NeuroPost adapte el contenido a tu negocio.</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              <div>
                <Label>Nombre del negocio *</Label>
                <input style={inputStyle} type="text" placeholder="Ej: Heladería La Nube" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              {dynamicQuestions.map((q) => {
                const options = SECTOR_SERVICE_OPTIONS[sector];
                return (
                  <div key={q.key}>
                    <Label>{q.label}</Label>
                    {options ? (
                      <select
                        style={selectStyle}
                        value={dynamicAnswers[q.key] ?? ''}
                        onChange={(e) => setDynamicAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                      >
                        <option value="">Elige una opción...</option>
                        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input style={inputStyle} type="text" placeholder={q.placeholder} value={dynamicAnswers[q.key] ?? ''} onChange={(e) => setDynamicAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
              <div>
                <Label>Ciudad <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span></Label>
                <select
                  style={selectStyle}
                  value={locationDropdown}
                  onChange={(e) => {
                    setLocationDropdown(e.target.value);
                    if (e.target.value !== '__otra__') setLocation(e.target.value);
                    else setLocation('');
                  }}
                >
                  <option value="">Selecciona tu ciudad...</option>
                  {CITY_OPTIONS.map((city) => <option key={city} value={city}>{city}</option>)}
                  <option value="__otra__">Otra ciudad...</option>
                </select>
                {locationDropdown === '__otra__' && (
                  <input style={{ ...inputStyle, marginTop: 8 }} type="text" placeholder="Escribe tu ciudad..." value={location} onChange={(e) => setLocation(e.target.value)} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(2)} />
              <BtnPrimary onClick={() => { if (!name.trim()) { toast.error('El nombre es obligatorio'); return; } setStep(4); }}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 4: Brand voice ── */}
        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Tu voz de marca</SectionTitle>
            <StepSub>Elige cómo quieres comunicarte con tu audiencia.</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              <div>
                <Label>Tono de comunicación</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TONE_OPTIONS.map((t) => (
                    <button key={t.value} type="button" onClick={() => setTone(t.value)} style={{
                      padding: '14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `1.5px solid ${tone === t.value ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      background: tone === t.value ? 'rgba(255,92,26,0.1)' : 'rgba(255,255,255,0.03)',
                      outline: 'none', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.88rem', color: tone === t.value ? INK : 'rgba(232,237,248,0.7)' }}>{t.label}</div>
                        {tone === t.value && <div style={{ width: 16, height: 16, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'white', fontWeight: 900, flexShrink: 0 }}>✓</div>}
                      </div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', color: MUTED }}>{t.desc}</div>
                      <div style={{ marginTop: 6, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.7rem', color: tone === t.value ? 'rgba(232,237,248,0.6)' : 'rgba(232,237,248,0.28)', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                        &ldquo;{toneExamples[t.value]}&rdquo;
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Palabras clave <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(selecciona las que encajan)</span></Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                  {(SECTOR_KEYWORD_SUGGESTIONS[sector] ?? ['artesanal', 'local', 'calidad', 'sostenible', 'profesional', 'exclusivo', 'fresco', 'auténtico']).map((kw) => {
                    const active = keywords.includes(kw);
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => active ? removeTag(keywords, setKeywords, kw) : addTag(keywords, setKeywords, kw)}
                        style={{
                          padding: '7px 14px', borderRadius: 40, cursor: 'pointer',
                          fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.82rem', fontWeight: 700,
                          border: `1.5px solid ${active ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                          background: active ? ACCENT : 'rgba(255,255,255,0.04)',
                          color: active ? 'white' : 'rgba(232,237,248,0.6)',
                          transition: 'all 0.15s', outline: 'none',
                        }}
                      >
                        {kw}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(3)} />
              <BtnPrimary onClick={() => setStep(5)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 5: Publish mode + colors ── */}
        {step === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <SectionTitle>Modo de publicación</SectionTitle>
            <StepSub>¿Cómo quieres que gestionemos tu contenido?</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PUBLISH_MODE_OPTIONS.map((m) => (
                <button key={m.value} type="button" onClick={() => setPublishMode(m.value)} style={{
                  padding: 0, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${publishMode === m.value ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                  background: publishMode === m.value ? 'rgba(255,92,26,0.08)' : 'rgba(255,255,255,0.02)',
                  outline: 'none', transition: 'all 0.15s', overflow: 'hidden',
                  boxShadow: publishMode === m.value ? `0 0 0 3px rgba(255,92,26,0.1)` : 'none',
                }}>
                  <img src={PUBLISH_MODE_IMGS[m.value]} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{m.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: publishMode === m.value ? INK : 'rgba(232,237,248,0.7)' }}>{m.label}</div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{m.desc}</div>
                    </div>
                    {publishMode === m.value && <span style={{ color: ACCENT, fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>✓</span>}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Frecuencia de publicación</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([2, 5, 7] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setPublishFrequency(freq)}
                    style={{
                      flex: 1, padding: '14px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                      border: `1.5px solid ${publishFrequency === freq ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      background: publishFrequency === freq ? 'rgba(255,92,26,0.1)' : 'rgba(255,255,255,0.03)',
                      outline: 'none', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.5rem', color: publishFrequency === freq ? INK : 'rgba(232,237,248,0.4)' }}>{freq}</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>posts/sem</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Colores de marca</Label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[{ label: 'Principal', value: primaryColor, set: setPrimaryColor }, { label: 'Secundario', value: secondaryColor, set: setSecondaryColor }].map((c) => {
                  const colorInputId = `brand-color-${c.label.toLowerCase().replace(/\s+/g, '-')}`;
                  return (
                    <div key={c.label} className="brandColorPicker">
                      <input
                        id={colorInputId}
                        type="color"
                        value={c.value}
                        onChange={(e) => c.set(e.target.value)}
                        className="brandColorInput"
                        title={`Seleccionar color ${c.label.toLowerCase()}`}
                        aria-label={`Color ${c.label.toLowerCase()}`}
                      />
                      <div>
                        <label htmlFor={colorInputId} className="brandColorLabel">{c.label}</label>
                        <div className="brandColorValue">{c.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <CouponInput
                onValidCoupon={(id, text) => { setPromoCodeId(id); setDiscountText(text); }}
                onClearCoupon={() => { setPromoCodeId(null); setDiscountText(''); }}
              />
              {discountText && <p style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: 6, fontFamily: "'Cabinet Grotesk', sans-serif" }}>{discountText}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingBottom: 4 }}>
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
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          padding: 2px;
          background: none;
        }

        .brandColorLabel {
          display: block;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: 'Cabinet Grotesk', sans-serif;
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
