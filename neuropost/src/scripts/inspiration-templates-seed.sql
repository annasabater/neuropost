-- NeuroPost inspiration templates seed data (35 templates)
-- Sectors: gastronomia, belleza, fitness, inmobiliaria, moda, servicios

-- ─── GASTRONOMÍA ─────────────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Producto en fondo de color plano',
  'Fotografía de producto sobre fondo liso de color sólido con iluminación de estudio',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['colorit','minimal'],
  'image',
  'Product shot of {producto} on solid {color} background, studio lighting, centered composition, {marca} branding, photorealistic, 4K',
  ARRAY['producto','colorful','studio']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Flat lay con ingredientes',
  'Vista cenital del producto rodeado de sus ingredientes principales sobre superficie rústica',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['editorial','artisan'],
  'image',
  'Overhead flat lay of {producto} surrounded by its key ingredients on rustic wooden surface, {marca} aesthetic, warm natural light, 4K',
  ARRAY['producto','ingredientes','flatlay']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Close-up con bokeh',
  'Primer plano macro del producto con fondo desenfocado y bokeh cremoso',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['elegant','lifestyle'],
  'image',
  'Ultra-close macro shot of {producto}, shallow depth of field with creamy bokeh background, {estilo} color grading, {marca} aesthetic',
  ARRAY['macro','bokeh','detalle']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Reel proceso de elaboración 15s',
  'Reel corto mostrando paso a paso la preparación del producto con close-ups dinámicos',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['dynamic','authentic'],
  'reel',
  '15-second reel script: show the step-by-step preparation of {producto} from raw ingredients to finished product, dynamic close-ups, trending audio',
  ARRAY['proceso','making-of','reels']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Before/after ingredientes → plato',
  'Carrusel de 2 diapositivas: ingredientes crudos y producto terminado desde el mismo ángulo',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['editorial','clean'],
  'carousel',
  '2-slide carousel: Slide 1 = raw ingredients laid out beautifully, Slide 2 = finished {producto}, same angle, {marca} color palette',
  ARRAY['antes-despues','proceso','carousel']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Oferta del día con texto grande',
  'Gráfico promocional llamativo con tipografía grande para destacar la oferta del día',
  ARRAY['gastronomia','heladeria','cafeteria','restaurante'],
  ARRAY['bold','colorit'],
  'image',
  'Bold promotional graphic for {producto} at {precio}, large typography, {color} brand colors, high contrast, eye-catching design',
  ARRAY['oferta','promo','texto']
);

-- ─── BELLEZA Y ESTÉTICA ───────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Antes/después simétrico',
  'Comparativa simétrica antes y después del tratamiento sobre fondo blanco limpio',
  ARRAY['belleza','estetica','peluqueria'],
  ARRAY['clean','editorial'],
  'image',
  'Side-by-side before/after comparison for {producto} treatment, symmetric composition, clean white background, professional lighting',
  ARRAY['antes-despues','resultado']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Close-up resultado',
  'Primer plano detallado del resultado del tratamiento con iluminación perfecta y alta definición',
  ARRAY['belleza','estetica','peluqueria'],
  ARRAY['elegant','macro'],
  'image',
  'Ultra-close detailed shot of {producto} beauty result, perfect lighting, high definition, {marca} aesthetic',
  ARRAY['resultado','detalle']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Reel proceso de tratamiento 30s',
  'Reel de 30 segundos mostrando el proceso profesional del tratamiento con transiciones fluidas',
  ARRAY['belleza','estetica','peluqueria'],
  ARRAY['dynamic','professional'],
  'reel',
  '30-second reel: professional beauty treatment process for {producto}, smooth transitions, satisfying ASMR-style close-ups',
  ARRAY['proceso','tutorial','reels']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Producto cosmético fondo neutro',
  'Fotografía de producto cosmético sobre fondo de mármol o neutro con estilo editorial',
  ARRAY['belleza','estetica','peluqueria'],
  ARRAY['minimal','elegant'],
  'image',
  'Product shot of {producto} cosmetic on clean marble/neutral background, professional product photography, {marca} color scheme',
  ARRAY['producto','cosmetic','minimal']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Testimonio cliente en texto',
  'Tarjeta de cita con testimonial de cliente sobre fondo claro con tipografía de marca',
  ARRAY['belleza','estetica','peluqueria'],
  ARRAY['clean','minimal'],
  'image',
  'Clean quote card with client testimonial about {marca} {producto} service, branded typography, light background',
  ARRAY['testimonio','social-proof']
);

-- ─── FITNESS ──────────────────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Persona entrenando con luz dramática',
  'Fotografía atlética dramática con iluminación de bajo contraste, potente y poderosa',
  ARRAY['fitness','gimnasio','deporte'],
  ARRAY['dynamic','dark'],
  'image',
  'Dramatic athletic shot of person performing {producto} exercise, low-key dramatic lighting, high contrast, powerful composition',
  ARRAY['entreno','motivacion','fitness']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Correcto vs incorrecto',
  'Carrusel educativo comparando la técnica correcta e incorrecta para el ejercicio',
  ARRAY['fitness','gimnasio','deporte'],
  ARRAY['educational','clean'],
  'carousel',
  '2-slide educational carousel comparing correct vs incorrect form for {producto} exercise, clear labels, clean background',
  ARRAY['tutorial','tecnica','carousel']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Reel rutina 5 ejercicios 30s',
  'Reel rápido de 30 segundos con 5 ejercicios, transiciones dinámicas y texto superpuesto',
  ARRAY['fitness','gimnasio','deporte'],
  ARRAY['dynamic','energetic'],
  'reel',
  '30-second quick workout reel showing 5 {producto} exercises, dynamic transitions, motivational energy, text overlay for each exercise',
  ARRAY['rutina','reels','tutorial']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Motivación texto sobre imagen oscura',
  'Cita motivacional potente superpuesta sobre imagen atlética dramática oscura',
  ARRAY['fitness','gimnasio','deporte'],
  ARRAY['dark','bold'],
  'image',
  'Powerful motivational quote about {marca} fitness philosophy overlaid on dark dramatic athletic background image',
  ARRAY['motivacion','texto','mood']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Resultado cliente antes/después',
  'Transformación auténtica del cliente con encuadre cálido y cercano, real y relatable',
  ARRAY['fitness','gimnasio','deporte'],
  ARRAY['authentic','lifestyle'],
  'image',
  'Authentic client transformation result for {marca} {producto} program, warm encouraging framing, real and relatable',
  ARRAY['resultado','transformacion','social-proof']
);

-- ─── INMOBILIARIA ─────────────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Interior con luz natural',
  'Fotografía de interior luminoso y amplio con luz de hora dorada y estética limpia',
  ARRAY['inmobiliaria','arquitectura'],
  ARRAY['minimal','elegant'],
  'image',
  'Bright airy interior shot of {producto} property, golden hour natural light, wide angle, clean staging, {marca} aesthetic',
  ARRAY['interior','propiedad','lifestyle']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Vista aérea o exterior al atardecer',
  'Vista aérea exterior de la propiedad durante la hora dorada con tonos cálidos aspiracionales',
  ARRAY['inmobiliaria','arquitectura'],
  ARRAY['premium','dramatic'],
  'image',
  'Golden hour exterior aerial view of {producto} property, warm sky tones, premium composition, aspirational feel',
  ARRAY['exterior','drone','premium']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Detalle arquitectónico',
  'Close-up de detalle arquitectónico destacando textura, material o elemento de diseño único',
  ARRAY['inmobiliaria','arquitectura'],
  ARRAY['editorial','minimal'],
  'image',
  'Close-up architectural detail of {producto} property — texture, material, or design element, editorial lighting, minimalist composition',
  ARRAY['detalle','arquitectura','design']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Tour virtual reel 30s',
  'Reel de tour virtual cinematográfico de 30 segundos con movimiento fluido por los espacios clave',
  ARRAY['inmobiliaria','arquitectura'],
  ARRAY['cinematic','premium'],
  'reel',
  '30-second virtual tour reel of {producto} property, smooth cinematic movement through key spaces, ambient music, text labels for rooms',
  ARRAY['tour','propiedad','reels']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Estadísticas mercado infografía',
  'Infografía limpia con visualización de datos del mercado inmobiliario con tipografía profesional',
  ARRAY['inmobiliaria','arquitectura'],
  ARRAY['clean','professional'],
  'image',
  'Clean data visualization infographic showing {producto} real estate market statistics, {marca} brand colors, professional typography',
  ARRAY['datos','mercado','infografia']
);

-- ─── MODA Y BOUTIQUE ──────────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Producto flat lay fondo neutro',
  'Flat lay de moda sobre fondo neutro con simetría perfecta y accesorios complementarios',
  ARRAY['moda','boutique','ropa'],
  ARRAY['minimal','editorial'],
  'image',
  'Fashion flat lay of {producto} clothing item on neutral background, perfect symmetry, styled with complementary accessories, {marca} palette',
  ARRAY['producto','flatlay','fashion']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Modelo outdoor con producto',
  'Fotografía editorial lifestyle de modelo con el producto en entorno urbano o natural',
  ARRAY['moda','boutique','ropa'],
  ARRAY['lifestyle','editorial'],
  'image',
  'Lifestyle editorial shot of model wearing {producto} in outdoor urban/natural setting, candid yet styled, {marca} color aesthetic',
  ARRAY['modelo','outdoor','lifestyle']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Detalle textura tejido',
  'Primer plano macro de la textura del tejido que muestra calidad y artesanía con luz suave',
  ARRAY['moda','boutique','ropa'],
  ARRAY['macro','elegant'],
  'image',
  'Ultra-close macro detail shot of {producto} fabric texture, showcasing quality and craftsmanship, soft complementary lighting',
  ARRAY['detalle','textura','calidad']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Look completo con accesorios',
  'Fotografía editorial del outfit completo con el producto como pieza protagonista y accesorios coordinados',
  ARRAY['moda','boutique','ropa'],
  ARRAY['editorial','colorit'],
  'image',
  'Complete outfit styling shot featuring {producto} as hero piece, coordinated accessories, {marca} color palette, fashion editorial feel',
  ARRAY['look','outfit','completo']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Reel unboxing o styling',
  'Reel de 30 segundos de unboxing o tutorial de styling rápido con audio trending y momento reveal',
  ARRAY['moda','boutique','ropa'],
  ARRAY['dynamic','authentic'],
  'reel',
  'Engaging 30-second reel showing {producto} unboxing or quick styling tutorial, trending audio, satisfying reveal moment',
  ARRAY['unboxing','styling','reels']
);

-- ─── SERVICIOS LOCALES ────────────────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Antes/después servicio',
  'Imagen split clara mostrando el resultado real del servicio antes y después, honesta y profesional',
  ARRAY['servicios','local','hogar'],
  ARRAY['clean','authentic'],
  'image',
  'Clear before/after split image showing {marca} {producto} service result, honest and professional, bright even lighting',
  ARRAY['resultado','antes-despues','calidad']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Equipo en acción',
  'Fotografía candid del equipo realizando el servicio, transmitiendo competencia y confianza',
  ARRAY['servicios','local','hogar'],
  ARRAY['authentic','lifestyle'],
  'image',
  'Candid professional shot of {marca} team performing {producto} service, competent and trustworthy impression, natural environment',
  ARRAY['equipo','profesional','confianza']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Oferta especial limitada',
  'Gráfico promocional llamativo para oferta limitada con diseño de urgencia y tipografía bold',
  ARRAY['servicios','local','hogar'],
  ARRAY['bold','colorit'],
  'image',
  'Eye-catching promotional graphic for {marca} {producto} limited offer, urgency-driven design, bold typography, {color} brand colors',
  ARRAY['oferta','promo','urgencia']
);

-- ─── EXTRA CROSS-SECTOR TEMPLATES ─────────────────────────────────────────────

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Carrusel educativo 5 pasos',
  'Carrusel de 5 diapositivas explicando un proceso o beneficio clave del negocio de forma visual',
  ARRAY['gastronomia','belleza','fitness','servicios'],
  ARRAY['educational','clean'],
  'carousel',
  '5-slide educational carousel explaining {producto} step-by-step process or key benefits, branded design, clear typography, {marca} color palette',
  ARRAY['educativo','proceso','carousel']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Reel presentación del negocio',
  'Reel de 30s presentando el negocio, el equipo y los servicios principales con texto superpuesto',
  ARRAY['gastronomia','belleza','fitness','inmobiliaria','moda','servicios'],
  ARRAY['dynamic','authentic'],
  'reel',
  '30-second brand introduction reel for {marca}, showing team, space, and key {producto} offerings, warm and inviting tone, text overlay',
  ARRAY['presentacion','marca','reels']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Cita inspiracional de marca',
  'Tarjeta con cita o valor de marca sobre fondo de color, tipografía elegante y logotipo',
  ARRAY['gastronomia','belleza','fitness','inmobiliaria','moda','servicios'],
  ARRAY['elegant','minimal'],
  'image',
  'Branded quote card featuring {marca} philosophy or value statement, elegant typography on {color} background, subtle logo placement',
  ARRAY['cita','valores','marca']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Producto con lifestyle persona',
  'Foto lifestyle de persona real usando o disfrutando el producto/servicio en entorno auténtico',
  ARRAY['gastronomia','belleza','fitness','moda','servicios'],
  ARRAY['lifestyle','authentic'],
  'image',
  'Authentic lifestyle shot of real person using or enjoying {producto} in natural setting, candid moment, {marca} color palette, warm and relatable',
  ARRAY['lifestyle','persona','autentico']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Infografía datos y estadísticas',
  'Infografía visualmente atractiva con datos clave, estadísticas o beneficios en colores de marca',
  ARRAY['fitness','inmobiliaria','servicios','belleza'],
  ARRAY['clean','professional'],
  'image',
  'Visually compelling infographic presenting key {producto} data, stats or benefits, {marca} brand colors, clean layout, professional typography',
  ARRAY['infografia','datos','educativo']
);

INSERT INTO inspiration_templates (title, description, sectors, styles, format, prompt_template, tags)
VALUES (
  'Story promocional con cuenta atrás',
  'Story vertical con oferta especial, cuenta atrás de urgencia y CTA claro con colores de marca',
  ARRAY['gastronomia','belleza','fitness','moda','servicios'],
  ARRAY['bold','colorit'],
  'story',
  'Vertical story format for {marca} {producto} special offer, countdown urgency element, bold CTA button, {color} brand palette, eye-catching',
  ARRAY['story','oferta','urgencia','cta']
);
