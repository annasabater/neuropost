// =============================================================================
// generate-demo-images.mjs
// =============================================================================
// Genera imágenes de demostración para cada tipo de negocio soportado en
// NeuroPost usando Replicate Flux Dev. Ejecuta una vez, guarda los resultados
// en demo-images-output.json con las URLs.
//
// USO:
//   REPLICATE_API_TOKEN=r8_xxx node scripts/generate-demo-images.mjs
//
// O con el token ya en el entorno:
//   node scripts/generate-demo-images.mjs

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) {
  console.error('❌  REPLICATE_API_TOKEN no está definido.');
  console.error('    Ejecuta: REPLICATE_API_TOKEN=r8_xxx node scripts/generate-demo-images.mjs');
  process.exit(1);
}

// ─── Definición de imágenes ───────────────────────────────────────────────────
// Cada entrada genera UNA imagen. Añade/quita según necesites.
// aspect_ratio: "1:1" para post cuadrado, "9:16" para story/reel

const IMAGES = [
  // ── HELADERÍA / HELADERÍA CREATIVA ─────────────────────────────────────────
  {
    id: 'ice_cream_creative',
    label: 'Heladería Creativa',
    aspect: '1:1',
    prompt: `Artistically styled ice cream photography for social media. Three levitating colorful gelato scoops — strawberry pink, pistachio green, mango yellow — mid-air above a pastel bubblegum pink marble surface. Surrounded by scattered sprinkles, mini waffle cones, macarons, and fresh strawberries. Soft studio lighting with gentle rim light. Bokeh background with subtle confetti. Commercial food photography, 85mm f/1.8, shallow depth of field, ultra-clean composition, vibrant saturated palette, Instagram editorial style, ultra-realistic.`,
  },
  {
    id: 'ice_cream_luxury',
    label: 'Heladería Gourmet',
    aspect: '1:1',
    prompt: `Luxury artisan ice cream shop interior photography. A perfectly crafted ice cream sundae in a crystal coupe glass on a white marble counter. Dark chocolate fudge drizzle, edible gold leaf, fresh raspberries, micro basil. Soft warm bokeh background showing an upscale Italian gelateria with pastel neon sign. Commercial food styling, moody editorial lighting, shallow depth of field, ultra-realistic, premium Instagram aesthetic.`,
  },

  // ── GIMNASIO / FITNESS ─────────────────────────────────────────────────────
  {
    id: 'gym_classic',
    label: 'Gimnasio Clásico',
    aspect: '1:1',
    prompt: `Classic professional gym photography. A muscular athlete performing a heavy barbell squat in a dimly lit industrial gym. Dramatic Rembrandt lighting, chalk dust floating in the air, iron weights in background, raw concrete walls. Black and white high-contrast editorial style with subtle warm tones on skin. Strong composition, powerful stance, motivational energy. Commercial fitness photography, 50mm f/2.0, ultra-realistic, cinematic grain.`,
  },
  {
    id: 'gym_modern',
    label: 'Gimnasio Moderno / Wellness',
    aspect: '1:1',
    prompt: `Modern luxury fitness studio photography. A woman in premium athletic wear performs yoga warrior pose in a bright minimalist studio. Warm golden morning light streaming through floor-to-ceiling windows, wooden floors, tropical plants in background. Soft editorial lighting, clean negative space. Lifestyle wellness photography, 35mm lens, airy pastel tones, Instagram health and wellness aesthetic, ultra-realistic, aspirational.`,
  },

  // ── CENTRO DE ESTÉTICA / BELLEZA ───────────────────────────────────────────
  {
    id: 'beauty_products',
    label: 'Centro de Estética — Productos',
    aspect: '1:1',
    prompt: `High-end skincare product photography. Three luxury serum and moisturizer bottles arranged on veined white Calacatta marble with gold accents. Surrounded by fresh rose petals, dried lavender sprigs, and a single lit candle. Soft studio lighting with subtle reflections, clean white background, soft shadows. Commercial beauty photography, product styling, editorial luxury aesthetic, ultra-realistic, 5K detail.`,
  },
  {
    id: 'beauty_spa',
    label: 'Centro de Estética — Spa',
    aspect: '1:1',
    prompt: `Luxury spa interior photography. An elegant treatment room with a white massage table draped in premium linen, a tray with hot stones, orchids in glass vases, and warm candle light. Neutral beige and cream tones with natural wood accents. Soft diffused window light, clean minimalist design. Lifestyle wellness photography, wide angle, ultra-realistic, aspirational editorial style, warm and calming atmosphere.`,
  },

  // ── RESTAURANTE ────────────────────────────────────────────────────────────
  {
    id: 'restaurant_plating',
    label: 'Restaurante — Plato',
    aspect: '1:1',
    prompt: `Fine dining restaurant food photography. An exquisitely plated main course — seared duck breast with cherry reduction, microgreens garnish, edible flowers, and a swoosh of parsnip purée on a matte black ceramic plate. Moody candlelight bokeh background showing a sophisticated restaurant interior. Side light from natural window, commercial food styling, 100mm macro, ultra-realistic, Michelin-star aesthetic.`,
  },
  {
    id: 'restaurant_brunch',
    label: 'Restaurante — Brunch Lifestyle',
    aspect: '1:1',
    prompt: `Bright lifestyle brunch photography for social media. Overhead flat-lay of a beautiful brunch spread on a white linen tablecloth. Avocado toast with poached eggs and micro herbs, fresh squeezed orange juice, granola bowl with berries, croissants, a latte with heart latte art. Warm natural morning light, clean editorial food styling, slight marble texture, ultra-realistic, aspirational Instagram aesthetic.`,
  },

  // ── CENTRO DE VELA / NÁUTICA ───────────────────────────────────────────────
  {
    id: 'sailing_golden',
    label: 'Centro de Vela — Atardecer',
    aspect: '1:1',
    prompt: `Luxury sailing yacht photography at golden hour. A sleek white sailing yacht gliding across crystal turquoise Mediterranean waters, sails fully open, catching the warm orange sunset light. Dramatic sky with orange and pink clouds, gentle sea spray, lens flare effect. Shot from a chase boat at water level. Lifestyle nautical photography, 70mm, warm golden tones, ultra-realistic, aspirational summer lifestyle aesthetic.`,
  },
  {
    id: 'sailing_lifestyle',
    label: 'Centro de Vela — Lifestyle',
    aspect: '1:1',
    prompt: `Sailing lifestyle photography. Happy group of young adults relaxing on the bow of a sailboat on a sunny Mediterranean day. Crystal blue water, white sails above, sunlight reflections on water. Candid authentic moment, genuine smiles, premium nautical clothing. Lifestyle photography, wide angle 24mm, warm vibrant tones, summer energy, ultra-realistic, aspirational social media content.`,
  },

  // ── ECOMMERCE / PRODUCTO ───────────────────────────────────────────────────
  {
    id: 'ecommerce_product',
    label: 'Ecommerce — Producto',
    aspect: '1:1',
    prompt: `Premium ecommerce product photography. A luxury perfume bottle floating on a seamless gradient background transitioning from soft lavender to warm gold. Dramatic studio lighting with sharp reflections on the glass, small water droplets on the bottle surface. Clean commercial photography, centred composition, ultra-sharp 5K detail, white and gold color palette, premium brand aesthetic, ultra-realistic.`,
  },
  {
    id: 'ecommerce_lifestyle',
    label: 'Ecommerce — Lifestyle',
    aspect: '1:1',
    prompt: `Modern ecommerce lifestyle photography. Flat-lay of curated lifestyle products — a premium notebook, minimalist watch, leather cardholder, succulent plant, and specialty coffee cup — arranged artfully on a light oak wood surface. Soft diffused natural light, clean negative space, neutral warm tones. Editorial commercial photography, overhead 45-degree angle, ultra-realistic, premium Instagram grid aesthetic.`,
  },

  // ── CLÍNICA / SALUD ────────────────────────────────────────────────────────
  {
    id: 'clinic_dental',
    label: 'Clínica Dental',
    aspect: '1:1',
    prompt: `Modern dental clinic photography. A beautiful woman with a perfect bright smile in a clean modern dental office. Professional warm lighting, white teeth, natural expression of confidence. Background shows a blurred modern clinic with bright white walls and dental equipment. Commercial healthcare photography, 85mm portrait lens, f/2.0, warm editorial tones, professional and trustworthy aesthetic, ultra-realistic.`,
  },
  {
    id: 'clinic_wellness',
    label: 'Clínica de Bienestar',
    aspect: '1:1',
    prompt: `Holistic wellness clinic photography. A clean bright reception area with warm wood tones, green plants, a Buddha sculpture, and a waiting area with white linen sofas. Soft morning light through sheer curtains, neutral palette of whites, creams and sage green. Architectural interior photography, wide angle 24mm, airy and calming atmosphere, premium healthcare aesthetic, ultra-realistic.`,
  },

  // ── INMOBILIARIA ───────────────────────────────────────────────────────────
  {
    id: 'real_estate_interior',
    label: 'Inmobiliaria — Interior',
    aspect: '1:1',
    prompt: `Luxury real estate interior photography. A stunning open-plan living room with floor-to-ceiling windows overlooking a Mediterranean landscape. White marble floors, designer furniture in neutral tones, statement chandelier, fresh flowers. Warm afternoon light flooding in, architectural editorial photography, wide angle 17mm, ultra-sharp, premium real estate aesthetic, ultra-realistic.`,
  },
  {
    id: 'real_estate_exterior',
    label: 'Inmobiliaria — Villa Exterior',
    aspect: '1:1',
    prompt: `Luxury villa exterior real estate photography. A modern minimalist white Mediterranean villa with an infinity pool overlooking the sea. Lush tropical landscaping, palm trees, outdoor sunbeds, golden hour light reflecting off the pool. Architectural photography, drone-angle perspective, warm sunset tones, ultra-sharp detail, premium lifestyle real estate aesthetic, ultra-realistic.`,
  },

  // ── CAFETERÍA / COFFEE ─────────────────────────────────────────────────────
  {
    id: 'coffee_latte_art',
    label: 'Cafetería — Latte Art',
    aspect: '1:1',
    prompt: `Specialty coffee shop photography. Extreme close-up of a perfectly crafted latte art in a ceramic cup — a detailed tulip pattern in steamed milk. Warm amber tones, dramatic side lighting, wooden café table with coffee beans scattered around. Shallow depth of field, commercial food photography, 100mm macro, f/2.8, warm cozy aesthetic, ultra-realistic, Instagram coffee culture.`,
  },
  {
    id: 'coffee_shop_interior',
    label: 'Cafetería — Interior',
    aspect: '1:1',
    prompt: `Trendy specialty coffee shop interior photography. A cozy café with exposed brick walls, hanging Edison bulbs, wooden shelves with coffee books and plants, a beautiful espresso machine on the counter. Morning light through large windows, warm amber and brown tones. Lifestyle interior photography, 28mm wide angle, ultra-realistic, aspirational café culture aesthetic, inviting atmosphere.`,
  },

  // ── MODA / BOUTIQUE ────────────────────────────────────────────────────────
  {
    id: 'fashion_editorial',
    label: 'Moda — Editorial',
    aspect: '1:1',
    prompt: `High fashion editorial photography. A model wearing an elegant minimalist outfit — structured blazer and wide-leg trousers in neutral beige tones — posed against a clean white seamless background. Professional studio strobe lighting, sharp editorial look, strong confident pose. Commercial fashion photography, 50mm f/4, ultra-sharp, premium brand aesthetic, ultra-realistic, Vogue-style composition.`,
  },
  {
    id: 'fashion_boutique',
    label: 'Moda — Boutique',
    aspect: '1:1',
    prompt: `Luxury fashion boutique interior photography. An immaculate high-end clothing boutique with clean white walls, marble floors, curated clothing racks with designer pieces, fresh white orchids in tall vases. Warm spot lighting on key garments, clean minimalist design, luxury retail aesthetic. Architectural interior photography, 24mm wide angle, premium fashion brand atmosphere, ultra-realistic.`,
  },

  // ── PELUQUERÍA / BARBERÍA ──────────────────────────────────────────────────
  {
    id: 'barbershop',
    label: 'Barbería Clásica',
    aspect: '1:1',
    prompt: `Classic premium barbershop photography. A skilled barber giving a precise fade haircut to a client in a vintage leather barber chair. Warm tungsten lighting, antique barber tools on marble shelf, vintage mirror, dark wood paneling. Commercial lifestyle photography, 35mm f/2.0, moody warm tones, timeless masculine aesthetic, ultra-realistic, editorial grooming content.`,
  },
  {
    id: 'hair_salon',
    label: 'Salón de Peluquería',
    aspect: '1:1',
    prompt: `Modern luxury hair salon photography. A hairstylist artfully blow-drying a client's glossy hair in a bright modern salon. White and gold interior, large mirror with Hollywood-style bulb lighting, fresh flowers on vanity. Warm editorial lighting, aspirational beauty lifestyle photography, 50mm portrait lens, f/2.0, ultra-realistic, premium salon aesthetic.`,
  },

  // ── PANADERÍA / ARTESANAL ─────────────────────────────────────────────────
  {
    id: 'bakery_artisan',
    label: 'Panadería Artesanal',
    aspect: '1:1',
    prompt: `Artisan bakery food photography. A rustic sourdough bread loaf just out of the oven, cracked golden crust, steam rising, resting on a worn wooden board. Scattered flour, wheat stalks, and a linen cloth. Warm dramatic side lighting from a single window, dark moody background. Commercial food photography, 50mm macro, f/2.0, warm earthy tones, artisanal craftsmanship aesthetic, ultra-realistic.`,
  },

  // ── CENTRO RECREATIVO / KARTS ─────────────────────────────────────────────
  {
    id: 'recreation_karting',
    label: 'Centro Recreativo — Karting',
    aspect: '1:1',
    prompt: `Dynamic karting race photography. A kart driver in full racing gear taking a tight corner at high speed, tire smoke, motion blur on background, dramatic action lighting. Colorful race track, vibrant energy, exciting composition. Sports action photography, panning technique, 70-200mm f/2.8, ultra-realistic, cinematic motion blur, exciting and fun social media content.`,
  },

  // ── YOGA / PILATES ────────────────────────────────────────────────────────
  {
    id: 'yoga_studio',
    label: 'Yoga & Pilates Studio',
    aspect: '1:1',
    prompt: `Serene yoga studio photography. A woman performs a graceful crow pose on a premium yoga mat in a minimalist studio. Morning light flooding through large windows with sheer curtains, wooden floors, white walls, a small buddha statue and succulents in the background. Lifestyle wellness photography, 35mm f/2.8, warm pastel tones, ultra-realistic, aspirational mindfulness aesthetic.`,
  },

  // ── TECNOLOGÍA / COWORKING ────────────────────────────────────────────────
  {
    id: 'coworking_space',
    label: 'Coworking & Tecnología',
    aspect: '1:1',
    prompt: `Modern coworking space photography. A bright open-plan collaborative workspace with young professionals working on laptops, exposed concrete ceiling with pendant lights, green plant walls, standing desks, whiteboards with colorful sticky notes. Warm natural daylight, casual startup culture energy. Interior lifestyle photography, 24mm wide angle, ultra-realistic, premium tech company aesthetic.`,
  },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function startPrediction(prompt, aspect = '1:1', retries = 5) {
  const body = {
    input: {
      prompt,
      aspect_ratio:         aspect,
      output_format:        'jpg',
      output_quality:       90,
      num_outputs:          1,
      num_inference_steps:  28,
      guidance_scale:       3.5,
      disable_safety_checker: true,
    },
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type':  'application/json',
        'Prefer':        'respond-async',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status === 503) {
      const waitSec = attempt * 15;
      console.log(`  ⏸️  Rate limit / throttle — esperando ${waitSec}s (intento ${attempt}/${retries})...`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.detail ?? res.statusText ?? '';
      if (msg.toLowerCase().includes('throttled') || msg.toLowerCase().includes('rate limit')) {
        const waitSec = attempt * 15;
        console.log(`  ⏸️  Throttled — esperando ${waitSec}s (intento ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw new Error(`Replicate start error: ${msg}`);
    }
    return res.json();
  }
  throw new Error('Max retries exceeded for rate limit');
}

async function pollPrediction(id, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    const data = await res.json();
    if (data.status === 'succeeded') return Array.isArray(data.output) ? data.output[0] : data.output;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Prediction ${id} ${data.status}: ${data.error ?? 'unknown'}`);
    }
  }
  throw new Error(`Prediction ${id} timed out after ${maxWaitMs}ms`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Concurrency=1 para cuentas sin tarjeta (rate limit: 1 req/min burst).
// Si tienes tarjeta en Replicate puedes subir a 3.
const CONCURRENCY = 1;
const DELAY_BETWEEN_MS = 12_000; // 12s entre requests para evitar throttling

async function generateBatch(items) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n📸  [${i+1}/${items.length}] ${item.label}`);

    try {
      const pred = await startPrediction(item.prompt, item.aspect);
      console.log(`  ⏳  prediction ${pred.id} — esperando resultado...`);
      const url = await pollPrediction(pred.id);
      console.log(`  ✅  ${url}`);
      results.push({ ...item, url, error: null });
    } catch (err) {
      console.error(`  ❌  ${err.message}`);
      results.push({ ...item, url: null, error: err.message });
    }

    // Pausa entre requests para respetar el rate limit
    if (i < items.length - 1) {
      process.stdout.write(`  💤  Esperando ${DELAY_BETWEEN_MS/1000}s antes del siguiente...\r`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
    }
  }
  return results;
}

console.log(`\n🚀  NeuroPost — Generador de imágenes de demo`);
console.log(`    Generando ${IMAGES.length} imágenes con Flux Dev...\n`);

const results = await generateBatch(IMAGES);

// ─── Guardar resultados ────────────────────────────────────────────────────────
const output = {
  generated_at: new Date().toISOString(),
  total: results.length,
  success: results.filter(r => r.url).length,
  failed:  results.filter(r => !r.url).length,
  images: results.map(({ id, label, aspect, url, error }) => ({ id, label, aspect, url, error })),
};

const outPath = join(__dirname, 'demo-images-output.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`\n───────────────────────────────────────────────`);
console.log(`✅  Completado: ${output.success}/${output.total} imágenes generadas`);
if (output.failed > 0) console.log(`❌  Fallidas: ${output.failed}`);
console.log(`📄  Resultados guardados en: scripts/demo-images-output.json`);
console.log(`\n📋  URLs generadas:`);
for (const img of output.images.filter(i => i.url)) {
  console.log(`   ${img.label.padEnd(35)} ${img.url}`);
}
