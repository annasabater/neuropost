'use client';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import type { SocialSector } from '@/types';

const UNS = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const SECTOR_INSPIRATION: Partial<Record<SocialSector, { img: string; title: string; format: string }[]>> = {
  restaurante: [
    { img: UNS('1565299624946-b28f40a0ae38'), title: 'Plato del día con luz natural', format: 'Imagen' },
    { img: UNS('1482049016688-2d3e1b311543'), title: 'Mesa preparada para servicio', format: 'Carrusel' },
    { img: UNS('1567306226416-28f0efdc88ce'), title: 'Detalle de ingredientes frescos', format: 'Reel' },
    { img: UNS('1517248135467-4c7edcad34c4'), title: 'Cocina en acción', format: 'Story' },
    { img: UNS('1414235077428-338989a2e8c0'), title: 'Ambiente del restaurante', format: 'Imagen' },
  ],
  heladeria: [
    { img: UNS('1563805042-7684c019e1cb'), title: 'Helado artesanal close-up', format: 'Imagen' },
    { img: UNS('1570145820259-b5b80c5c8bd6'), title: 'Sabores del día en vitrina', format: 'Carrusel' },
    { img: UNS('1497034825429-c343d7c6a68f'), title: 'Proceso de elaboración', format: 'Reel' },
    { img: UNS('1501443762-a8c4ed09c6e0'), title: 'Cucurucho perfecto', format: 'Story' },
    { img: UNS('1557142046-c704a3adf364'), title: 'Helado con toppings', format: 'Imagen' },
  ],
  cafeteria: [
    { img: UNS('1501339847302-ac426a4a7cbb'), title: 'Latte art perfecto', format: 'Imagen' },
    { img: UNS('1495474472287-4d71bcdd2085'), title: 'Rincón acogedor del café', format: 'Carrusel' },
    { img: UNS('1521017432531-fbd92d768814'), title: 'Brunch del domingo', format: 'Reel' },
    { img: UNS('1509042239860-f550ce710b93'), title: 'Café de especialidad', format: 'Story' },
    { img: UNS('1442512595331-e89e73853f31'), title: 'Bollería del día', format: 'Imagen' },
  ],
  gym: [
    { img: UNS('1534438327276-14e5300c3a48'), title: 'Clase grupal en acción', format: 'Reel' },
    { img: UNS('1571019614242-c5c5dee9f50b'), title: 'Entrenamiento funcional', format: 'Imagen' },
    { img: UNS('1517963879433-6ad2a56fcd15'), title: 'Motivación matutina', format: 'Story' },
    { img: UNS('1549060279-7e168fcee0c2'), title: 'Transformación de cliente', format: 'Carrusel' },
    { img: UNS('1518611012118-696072aa579a'), title: 'Equipamiento premium', format: 'Imagen' },
  ],
  barberia: [
    { img: UNS('1503951914875-452162b0f3f1'), title: 'Corte clásico en proceso', format: 'Reel' },
    { img: UNS('1508214751196-c5bf6f5e2751'), title: 'Detalle de degradado', format: 'Imagen' },
    { img: UNS('1560066984-138dadb4c305'), title: 'Herramientas del oficio', format: 'Story' },
    { img: UNS('1621605815971-fbc98d665033'), title: 'Antes y después', format: 'Carrusel' },
    { img: UNS('1599351431613-18ef1fdd27e1'), title: 'Ambiente de la barbería', format: 'Imagen' },
  ],
  boutique: [
    { img: UNS('1441984904996-e0b6ba687e04'), title: 'Nueva colección en percha', format: 'Imagen' },
    { img: UNS('1558618666-fcd25c85cd64'), title: 'Look del día', format: 'Carrusel' },
    { img: UNS('1507003211169-0a1dd7228f2d'), title: 'Detalle de tejido', format: 'Story' },
    { img: UNS('1542291026-7eec264c27ff'), title: 'Calzado de temporada', format: 'Imagen' },
    { img: UNS('1445205170230-053b83016050'), title: 'Escaparate renovado', format: 'Reel' },
  ],
  inmobiliaria: [
    { img: UNS('1560518883-ce09059eeffa'), title: 'Salón luminoso con vistas', format: 'Imagen' },
    { img: UNS('1570129477492-45c003edd2be'), title: 'Cocina moderna reformada', format: 'Carrusel' },
    { img: UNS('1582653291997-79a4f2b7d9a7'), title: 'Terraza con atardecer', format: 'Story' },
    { img: UNS('1564013799919-ab600027ffc6'), title: 'Dormitorio principal', format: 'Imagen' },
    { img: UNS('1502672260266-1c1ef2d93688'), title: 'Tour del piso', format: 'Reel' },
  ],
  floristeria: [
    { img: UNS('1487530811576-3780949e7b0b'), title: 'Ramo de temporada', format: 'Imagen' },
    { img: UNS('1499444819541-60e4a698ecf5'), title: 'Composición de boda', format: 'Carrusel' },
    { img: UNS('1439127989242-9da695f9ca26'), title: 'Flores frescas del día', format: 'Story' },
    { img: UNS('1490750967868-88aa4f44baee'), title: 'Centro de mesa', format: 'Imagen' },
    { img: UNS('1455659817273-f96807779a8a'), title: 'Proceso de montaje', format: 'Reel' },
  ],
  yoga: [
    { img: UNS('1571019614242-c5c5dee9f50b'), title: 'Clase al amanecer', format: 'Reel' },
    { img: UNS('1506126613408-eca07ce68773'), title: 'Postura de equilibrio', format: 'Imagen' },
    { img: UNS('1544367654-00eb648f0b1f'), title: 'Meditación guiada', format: 'Story' },
    { img: UNS('1545389336-cf090694435e'), title: 'Espacio de práctica', format: 'Imagen' },
    { img: UNS('1552196563-55cd4e45efb3'), title: 'Yoga al aire libre', format: 'Carrusel' },
  ],
  dental: [
    { img: UNS('1559757148-5c350d0d3c56'), title: 'Sonrisa perfecta', format: 'Imagen' },
    { img: UNS('1519494026892-80bbd2d6fd0d'), title: 'Equipo profesional', format: 'Carrusel' },
    { img: UNS('1512621776951-a57141f2eefd'), title: 'Instalaciones modernas', format: 'Story' },
    { img: UNS('1606811841689-23dfddce3e95'), title: 'Resultado de blanqueamiento', format: 'Imagen' },
    { img: UNS('1588776814546-1ffcf47267a5'), title: 'Consejo dental de la semana', format: 'Reel' },
  ],
  estetica: [
    { img: UNS('1540555700478-4be289fbecef'), title: 'Tratamiento facial relajante', format: 'Imagen' },
    { img: UNS('1604654894610-df63bc536371'), title: 'Detalle de manicura', format: 'Reel' },
    { img: UNS('1556228578-8c89e6adf883'), title: 'Productos de cosmética', format: 'Story' },
    { img: UNS('1515377905703-c4788e51af15'), title: 'Ambiente spa', format: 'Carrusel' },
    { img: UNS('1507003211169-0a1dd7228f2d'), title: 'Resultado del tratamiento', format: 'Imagen' },
  ],
};

const DEFAULT_INSPIRATION = [
  { img: UNS('1482049016688-2d3e1b311543'), title: 'Foto de producto con fondo limpio', format: 'Imagen' },
  { img: UNS('1558618666-fcd25c85cd64'), title: 'Contenido de estilo de vida', format: 'Carrusel' },
  { img: UNS('1570129477492-45c003edd2be'), title: 'Espacio de trabajo premium', format: 'Story' },
  { img: UNS('1506126613408-eca07ce68773'), title: 'Momento auténtico', format: 'Reel' },
  { img: UNS('1517248135467-4c7edcad34c4'), title: 'Proceso detrás de escenas', format: 'Imagen' },
];

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function InspirationTeaser() {
  const brand = useAppStore((s) => s.brand);
  const sector = brand?.sector ?? 'otro';
  const items = SECTOR_INSPIRATION[sector] ?? DEFAULT_INSPIRATION;

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{
          fontFamily: f, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.14em',
          color: 'var(--text-tertiary)', margin: 0,
        }}>
          Inspiración para tu negocio
        </h2>
        <Link href="/inspiracion" style={{
          fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none',
          fontFamily: f, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Ver todas las ideas →
        </Link>
      </div>

      {/* Carousel */}
      <div style={{
        display: 'flex', gap: '1px', background: 'var(--border)',
        border: '1px solid var(--border)', overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {items.map((item, i) => (
          <Link key={i} href="/inspiracion" style={{
            flex: '0 0 220px', scrollSnapAlign: 'start',
            background: 'var(--bg)', textDecoration: 'none',
            display: 'block', transition: 'opacity 0.2s',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.img}
              alt={item.title}
              style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '12px 14px' }}>
              <p style={{
                fontFamily: f, fontSize: 13, fontWeight: 600,
                color: 'var(--text-primary)', lineHeight: 1.3,
                marginBottom: 4,
              }}>
                {item.title}
              </p>
              <p style={{
                fontFamily: f, fontSize: 11, fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
              }}>
                {item.format}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
