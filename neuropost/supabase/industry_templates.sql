-- =============================================================================
-- Industry Templates + Content Categories + Image Validations
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

create extension if not exists "uuid-ossp";

-- ─── Industry Templates ───────────────────────────────────────────────────────
-- Catálogo de plantillas por sector. Cada sector tiene categorías base que
-- se precargan en el onboarding cuando el cliente selecciona su tipo de negocio.

create table if not exists public.industry_templates (
  id               uuid primary key default uuid_generate_v4(),
  industry_key     text not null unique,
  display_name_es  text not null,
  icon             text,
  default_categories jsonb not null default '[]',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- No RLS — es una tabla de configuración pública (solo lectura para los clientes)
alter table public.industry_templates enable row level security;

create policy "industry_templates: public read"
  on public.industry_templates for select
  using (true);

create policy "industry_templates: service role write"
  on public.industry_templates for all
  using (auth.role() = 'service_role');

-- ─── Content Categories ───────────────────────────────────────────────────────
-- Categorías de contenido específicas de cada negocio. Combinan las del
-- template del sector + las que añade el usuario + las sugeridas por IA.

create table if not exists public.content_categories (
  id           uuid primary key default uuid_generate_v4(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  category_key text not null,
  name         text not null,
  source       text not null default 'template' check (source in ('template', 'user', 'ai_suggested')),
  active       boolean not null default true,
  created_at   timestamptz default now(),
  unique (brand_id, category_key)
);

alter table public.content_categories enable row level security;

create policy "content_categories: brand owner access"
  on public.content_categories for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = content_categories.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = content_categories.brand_id
        and brands.user_id = auth.uid()
    )
  );

create policy "content_categories: service role full access"
  on public.content_categories for all
  using (auth.role() = 'service_role');

create index if not exists idx_content_categories_brand on public.content_categories(brand_id);
create index if not exists idx_content_categories_active on public.content_categories(brand_id, active);

-- ─── Image Validations ────────────────────────────────────────────────────────
-- Registra cada intento del agente validador de imágenes.

create table if not exists public.image_validations (
  id                   uuid primary key default uuid_generate_v4(),
  post_id              uuid not null references public.posts(id) on delete cascade,
  attempt_number       int  not null check (attempt_number between 1 and 3),
  image_url            text not null,
  approved             boolean not null,
  confidence           float not null,
  issues               jsonb not null default '[]',
  suggested_prompt_fix text,
  original_prompt      text not null,
  created_at           timestamptz default now()
);

alter table public.image_validations enable row level security;

create policy "image_validations: brand owner access"
  on public.image_validations for all
  using (
    exists (
      select 1 from public.posts
      join public.brands on brands.id = posts.brand_id
      where posts.id = image_validations.post_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts
      join public.brands on brands.id = posts.brand_id
      where posts.id = image_validations.post_id
        and brands.user_id = auth.uid()
    )
  );

create policy "image_validations: service role full access"
  on public.image_validations for all
  using (auth.role() = 'service_role');

create index if not exists idx_image_validations_post on public.image_validations(post_id);

-- ─── Seed: industry_templates ─────────────────────────────────────────────────

insert into public.industry_templates (industry_key, display_name_es, icon, default_categories) values

('gym', 'Gimnasio / Centro Fitness', '💪', '[
  {"key":"entrenamiento","name":"Entrenamiento","description":"Ejercicios, rutinas, técnicas, demos de movimientos"},
  {"key":"transformaciones","name":"Transformaciones","description":"Antes/después de clientes, historias de progreso"},
  {"key":"nutricion","name":"Nutrición","description":"Consejos de alimentación, recetas fit, meal prep"},
  {"key":"suplementacion","name":"Suplementación","description":"Info sobre proteínas, creatina, vitaminas, productos de la tienda"},
  {"key":"clases_horarios","name":"Clases y horarios","description":"Promoción de clases grupales, spinning, yoga, crossfit, cambios de horario"},
  {"key":"equipo_entrenadores","name":"Equipo / Entrenadores","description":"Presentación de entrenadores, certificaciones, especialidades"},
  {"key":"comunidad","name":"Comunidad","description":"Eventos, retos, fotos de grupo, ambiente del gym"},
  {"key":"instalaciones","name":"Instalaciones","description":"Tour del gym, máquinas nuevas, zonas de entrenamiento"},
  {"key":"motivacion","name":"Motivación","description":"Frases motivacionales, mindset, disciplina, constancia"},
  {"key":"promociones","name":"Promociones","description":"Ofertas de matrícula, descuentos, packs, Black Friday, verano"}
]'),

('beauty_salon', 'Estética / Peluquería', '✨', '[
  {"key":"antes_despues","name":"Antes / Después","description":"Resultados de tratamientos, cortes, coloraciones, uñas"},
  {"key":"tendencias","name":"Tendencias","description":"Estilos de temporada, colores de moda, técnicas nuevas"},
  {"key":"tratamientos","name":"Tratamientos","description":"Explicación de servicios: keratina, microblading, limpieza facial, láser"},
  {"key":"productos","name":"Productos","description":"Productos que usáis o vendéis, recomendaciones de cuidado"},
  {"key":"consejos_cuidado","name":"Consejos de cuidado","description":"Tips para pelo, piel, uñas en casa entre visitas"},
  {"key":"equipo","name":"Equipo","description":"Presentación de estilistas, especialistas, su trabajo y estilo"},
  {"key":"detras_de_escena","name":"Detrás de escena","description":"Proceso de un tratamiento, preparación, el día a día del salón"},
  {"key":"resenas_clientes","name":"Reseñas / Clientes","description":"Testimonios, clientes contentos, valoraciones de Google"},
  {"key":"ambiente_local","name":"Ambiente / Local","description":"Fotos del salón, decoración, detalles que muestren la experiencia"},
  {"key":"promociones","name":"Promociones","description":"Ofertas, packs, descuentos por temporada, referidos"}
]'),

('restaurant', 'Restaurante / Gastronomía', '🍽️', '[
  {"key":"platos_carta","name":"Platos / Carta","description":"Fotos de platos de la carta, platos estrella, best sellers"},
  {"key":"plato_del_dia","name":"Plato del día / Menú","description":"Menú diario, sugerencia del chef, plato de temporada"},
  {"key":"cocina_en_accion","name":"Cocina en acción","description":"El chef cocinando, emplatado, proceso de elaboración"},
  {"key":"ingredientes_producto","name":"Ingredientes / Producto","description":"Materia prima de calidad, proveedor local, producto de temporada"},
  {"key":"equipo","name":"Equipo","description":"Presentación del chef, camareros, equipo de cocina, historia del fundador"},
  {"key":"ambiente_local","name":"Ambiente / Local","description":"Terraza, interior, decoración, detalles que transmitan la experiencia"},
  {"key":"eventos","name":"Eventos","description":"Cenas especiales, maridajes, showcooking, reservas para grupos"},
  {"key":"resenas_clientes","name":"Reseñas / Clientes","description":"Opiniones reales, clientes disfrutando, valoraciones de Google/TripAdvisor"},
  {"key":"bebidas","name":"Bebidas / Bodega","description":"Carta de vinos, cócteles, nuevas incorporaciones, maridaje sugerido"},
  {"key":"promociones","name":"Promociones","description":"Happy hour, 2x1, menú especial de fin de semana, descuento reserva online"}
]'),

('dental_clinic', 'Clínica Dental', '🦷', '[
  {"key":"tratamientos","name":"Tratamientos","description":"Ortodoncia, implantes, blanqueamiento, estética dental"},
  {"key":"antes_despues","name":"Antes / Después","description":"Resultados reales de tratamientos con consentimiento del paciente"},
  {"key":"equipo","name":"Equipo","description":"Presentación de dentistas, especialistas, su formación y experiencia"},
  {"key":"tecnologia","name":"Tecnología","description":"Equipamiento moderno, escáneres 3D, tratamientos mínimamente invasivos"},
  {"key":"consejos_salud_bucal","name":"Consejos de salud bucal","description":"Tips de higiene, cepillado, alimentación para dientes sanos"},
  {"key":"instalaciones","name":"Instalaciones","description":"La clínica, consultorios, sala de espera, ambiente tranquilo"},
  {"key":"preguntas_frecuentes","name":"Preguntas frecuentes","description":"Dudas comunes sobre tratamientos, precios, dolor, duración"},
  {"key":"resenas_pacientes","name":"Reseñas / Pacientes","description":"Testimonios de pacientes satisfechos, valoraciones de Google"}
]'),

('clothing_store', 'Tienda de Ropa / Moda', '👗', '[
  {"key":"novedades","name":"Novedades","description":"Nuevas prendas, colecciones, primera tanda de temporada"},
  {"key":"outfits_looks","name":"Outfits / Looks","description":"Combinaciones completas, styling inspiracional, cómo llevar las prendas"},
  {"key":"rebajas","name":"Rebajas / Ofertas","description":"Sales, descuentos, últimas unidades, precio especial"},
  {"key":"detras_de_escena","name":"Detrás de escena","description":"Proceso de selección de prendas, llegada de mercancía, el equipo"},
  {"key":"clientes","name":"Clientes","description":"Fotos de clientas con sus compras, reseñas, look del día"},
  {"key":"temporada","name":"Temporada","description":"Tendencias de la temporada, colores del año, prendas imprescindibles"},
  {"key":"accesorios","name":"Accesorios","description":"Bolsos, joyería, cinturones, complementos que combinan con la ropa"},
  {"key":"sostenibilidad","name":"Sostenibilidad","description":"Materiales sostenibles, moda consciente, prendas de calidad duradera"}
]'),

('real_estate', 'Inmobiliaria', '🏠', '[
  {"key":"propiedades","name":"Propiedades","description":"Pisos, casas, locales en venta o alquiler con fotos y precio"},
  {"key":"tours_virtuales","name":"Tours virtuales","description":"Vídeos o imágenes 360º de propiedades disponibles"},
  {"key":"barrio_zona","name":"Barrio / Zona","description":"Ventajas de la ubicación, servicios cercanos, estilo de vida"},
  {"key":"consejos_compra","name":"Consejos compra / alquiler","description":"Guías para compradores, errores a evitar, documentación necesaria"},
  {"key":"testimonios","name":"Testimonios","description":"Historias de clientes que encontraron su hogar, casos de éxito"},
  {"key":"equipo","name":"Equipo","description":"Presentación de agentes, su experiencia, zonas especializadas"},
  {"key":"mercado_inmobiliario","name":"Mercado inmobiliario","description":"Tendencias del mercado, evolución de precios, noticias del sector"},
  {"key":"resenas","name":"Reseñas","description":"Valoraciones de clientes en Google, portales, referencias"}
]')

on conflict (industry_key) do update set
  display_name_es    = excluded.display_name_es,
  icon               = excluded.icon,
  default_categories = excluded.default_categories,
  updated_at         = now();
