// =============================================================================
// Industry Templates — client-side data
// =============================================================================
// Mirrors the SQL seed in supabase/industry_templates.sql.
// Used by the onboarding UI without a DB round-trip, and by the API endpoint
// as a fallback when the DB table hasn't been seeded yet.

export interface TemplateCategoryDef {
  key:         string;
  name:        string;
  description: string;
}

export interface IndustryTemplate {
  industry_key:       string;
  display_name_es:    string;
  icon:               string;
  default_categories: TemplateCategoryDef[];
}

// Maps from SocialSector values to industry_key (for easy lookup from onboarding)
export const SECTOR_TO_INDUSTRY_KEY: Record<string, string> = {
  gym:              'gym',
  yoga:             'gym',
  barberia:         'beauty_salon',
  nail_art:         'beauty_salon',
  estetica:         'beauty_salon',
  maquillaje:       'beauty_salon',
  skincare:         'beauty_salon',
  restaurante:      'restaurant',
  heladeria:        'restaurant',
  cafeteria:        'restaurant',
  cocteleria:       'restaurant',
  street_food:      'restaurant',
  vinoteca:         'restaurant',
  panaderia:        'restaurant',
  dental:           'dental_clinic',
  boutique:         'clothing_store',
  moda_hombre:      'clothing_store',
  zapateria:        'clothing_store',
  inmobiliaria:     'real_estate',
  inmobiliaria_lujo:'real_estate',
};

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    industry_key:    'gym',
    display_name_es: 'Gimnasio / Centro Fitness',
    icon:            '💪',
    default_categories: [
      { key: 'entrenamiento',      name: 'Entrenamiento',        description: 'Ejercicios, rutinas, técnicas, demos de movimientos' },
      { key: 'transformaciones',   name: 'Transformaciones',     description: 'Antes/después de clientes, historias de progreso' },
      { key: 'nutricion',          name: 'Nutrición',            description: 'Consejos de alimentación, recetas fit, meal prep' },
      { key: 'suplementacion',     name: 'Suplementación',       description: 'Info sobre proteínas, creatina, vitaminas, productos de la tienda' },
      { key: 'clases_horarios',    name: 'Clases y horarios',    description: 'Promoción de clases grupales, spinning, yoga, crossfit, cambios de horario' },
      { key: 'equipo_entrenadores',name: 'Equipo / Entrenadores',description: 'Presentación de entrenadores, certificaciones, especialidades' },
      { key: 'comunidad',          name: 'Comunidad',            description: 'Eventos, retos, fotos de grupo, ambiente del gym' },
      { key: 'instalaciones',      name: 'Instalaciones',        description: 'Tour del gym, máquinas nuevas, zonas de entrenamiento' },
      { key: 'motivacion',         name: 'Motivación',           description: 'Frases motivacionales, mindset, disciplina, constancia' },
      { key: 'promociones',        name: 'Promociones',          description: 'Ofertas de matrícula, descuentos, packs, Black Friday, verano' },
    ],
  },
  {
    industry_key:    'beauty_salon',
    display_name_es: 'Estética / Peluquería',
    icon:            '✨',
    default_categories: [
      { key: 'antes_despues',    name: 'Antes / Después',     description: 'Resultados de tratamientos, cortes, coloraciones, uñas' },
      { key: 'tendencias',       name: 'Tendencias',          description: 'Estilos de temporada, colores de moda, técnicas nuevas' },
      { key: 'tratamientos',     name: 'Tratamientos',        description: 'Explicación de servicios: keratina, microblading, limpieza facial, láser' },
      { key: 'productos',        name: 'Productos',           description: 'Productos que usáis o vendéis, recomendaciones de cuidado' },
      { key: 'consejos_cuidado', name: 'Consejos de cuidado', description: 'Tips para pelo, piel, uñas en casa entre visitas' },
      { key: 'equipo',           name: 'Equipo',              description: 'Presentación de estilistas, especialistas, su trabajo y estilo' },
      { key: 'detras_de_escena', name: 'Detrás de escena',   description: 'Proceso de un tratamiento, preparación, el día a día del salón' },
      { key: 'resenas_clientes', name: 'Reseñas / Clientes', description: 'Testimonios, clientes contentos, valoraciones de Google' },
      { key: 'ambiente_local',   name: 'Ambiente / Local',   description: 'Fotos del salón, decoración, detalles que muestren la experiencia' },
      { key: 'promociones',      name: 'Promociones',         description: 'Ofertas, packs, descuentos por temporada, referidos' },
    ],
  },
  {
    industry_key:    'restaurant',
    display_name_es: 'Restaurante / Gastronomía',
    icon:            '🍽️',
    default_categories: [
      { key: 'platos_carta',         name: 'Platos / Carta',         description: 'Fotos de platos de la carta, platos estrella, best sellers' },
      { key: 'plato_del_dia',        name: 'Plato del día / Menú',   description: 'Menú diario, sugerencia del chef, plato de temporada' },
      { key: 'cocina_en_accion',     name: 'Cocina en acción',       description: 'El chef cocinando, emplatado, proceso de elaboración' },
      { key: 'ingredientes_producto',name: 'Ingredientes / Producto', description: 'Materia prima de calidad, proveedor local, producto de temporada' },
      { key: 'equipo',               name: 'Equipo',                 description: 'Presentación del chef, camareros, equipo de cocina, historia del fundador' },
      { key: 'ambiente_local',       name: 'Ambiente / Local',       description: 'Terraza, interior, decoración, detalles que transmitan la experiencia' },
      { key: 'eventos',              name: 'Eventos',                description: 'Cenas especiales, maridajes, showcooking, reservas para grupos' },
      { key: 'resenas_clientes',     name: 'Reseñas / Clientes',    description: 'Opiniones reales, clientes disfrutando, valoraciones de Google/TripAdvisor' },
      { key: 'bebidas',              name: 'Bebidas / Bodega',       description: 'Carta de vinos, cócteles, nuevas incorporaciones, maridaje sugerido' },
      { key: 'promociones',          name: 'Promociones',            description: 'Happy hour, 2x1, menú especial de fin de semana, descuento reserva online' },
    ],
  },
  {
    industry_key:    'dental_clinic',
    display_name_es: 'Clínica Dental',
    icon:            '🦷',
    default_categories: [
      { key: 'tratamientos',         name: 'Tratamientos',            description: 'Ortodoncia, implantes, blanqueamiento, estética dental' },
      { key: 'antes_despues',        name: 'Antes / Después',         description: 'Resultados reales de tratamientos con consentimiento del paciente' },
      { key: 'equipo',               name: 'Equipo',                  description: 'Presentación de dentistas, especialistas, su formación y experiencia' },
      { key: 'tecnologia',           name: 'Tecnología',              description: 'Equipamiento moderno, escáneres 3D, tratamientos mínimamente invasivos' },
      { key: 'consejos_salud_bucal', name: 'Consejos de salud bucal', description: 'Tips de higiene, cepillado, alimentación para dientes sanos' },
      { key: 'instalaciones',        name: 'Instalaciones',           description: 'La clínica, consultorios, sala de espera, ambiente tranquilo' },
      { key: 'preguntas_frecuentes', name: 'Preguntas frecuentes',    description: 'Dudas comunes sobre tratamientos, precios, dolor, duración' },
      { key: 'resenas_pacientes',    name: 'Reseñas / Pacientes',     description: 'Testimonios de pacientes satisfechos, valoraciones de Google' },
    ],
  },
  {
    industry_key:    'clothing_store',
    display_name_es: 'Tienda de Ropa / Moda',
    icon:            '👗',
    default_categories: [
      { key: 'novedades',       name: 'Novedades',      description: 'Nuevas prendas, colecciones, primera tanda de temporada' },
      { key: 'outfits_looks',   name: 'Outfits / Looks', description: 'Combinaciones completas, styling inspiracional, cómo llevar las prendas' },
      { key: 'rebajas',         name: 'Rebajas / Ofertas', description: 'Sales, descuentos, últimas unidades, precio especial' },
      { key: 'detras_de_escena',name: 'Detrás de escena', description: 'Proceso de selección de prendas, llegada de mercancía, el equipo' },
      { key: 'clientes',        name: 'Clientes',        description: 'Fotos de clientas con sus compras, reseñas, look del día' },
      { key: 'temporada',       name: 'Temporada',       description: 'Tendencias de la temporada, colores del año, prendas imprescindibles' },
      { key: 'accesorios',      name: 'Accesorios',      description: 'Bolsos, joyería, cinturones, complementos que combinan con la ropa' },
      { key: 'sostenibilidad',  name: 'Sostenibilidad',  description: 'Materiales sostenibles, moda consciente, prendas de calidad duradera' },
    ],
  },
  {
    industry_key:    'real_estate',
    display_name_es: 'Inmobiliaria',
    icon:            '🏠',
    default_categories: [
      { key: 'propiedades',         name: 'Propiedades',              description: 'Pisos, casas, locales en venta o alquiler con fotos y precio' },
      { key: 'tours_virtuales',     name: 'Tours virtuales',          description: 'Vídeos o imágenes 360º de propiedades disponibles' },
      { key: 'barrio_zona',         name: 'Barrio / Zona',            description: 'Ventajas de la ubicación, servicios cercanos, estilo de vida' },
      { key: 'consejos_compra',     name: 'Consejos compra / alquiler', description: 'Guías para compradores, errores a evitar, documentación necesaria' },
      { key: 'testimonios',         name: 'Testimonios',              description: 'Historias de clientes que encontraron su hogar, casos de éxito' },
      { key: 'equipo',              name: 'Equipo',                   description: 'Presentación de agentes, su experiencia, zonas especializadas' },
      { key: 'mercado_inmobiliario',name: 'Mercado inmobiliario',     description: 'Tendencias del mercado, evolución de precios, noticias del sector' },
      { key: 'resenas',             name: 'Reseñas',                  description: 'Valoraciones de clientes en Google, portales, referencias' },
    ],
  },
];

/** Returns the template for a sector key (falls back to empty if no match) */
export function getTemplateForSector(sectorKey: string): IndustryTemplate | null {
  const industryKey = SECTOR_TO_INDUSTRY_KEY[sectorKey];
  if (!industryKey) return null;
  return INDUSTRY_TEMPLATES.find((t) => t.industry_key === industryKey) ?? null;
}
