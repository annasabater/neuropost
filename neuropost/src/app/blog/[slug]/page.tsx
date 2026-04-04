import type { Metadata } from 'next';
import Link from 'next/link';

const ARTICLES: Record<string, {
  title: string; description: string; date: string; sector: string; readTime: string; headings: string[]; content: string;
}> = {
  'instagram-heladeria': {
    title: 'Cómo gestionar Instagram para tu heladería',
    description: 'Guía completa para dueños de heladerías que quieren crecer en redes sin perder el tiempo.',
    date: '1 de junio de 2025', sector: 'Heladería', readTime: '5 min',
    headings: ['Por qué Instagram es clave', 'Qué publicar y cuándo', 'El error que cometen todos', 'Cómo automatizarlo con IA'],
    content: `<h2>Por qué Instagram es clave para heladerías</h2><p>Las heladerías tienen algo que pocas categorías tienen: un producto fotogénico, estacional y emocional. Un helado de pistacho bien iluminado genera más engagement que cualquier copy creativo. La mayoría de los dueños no tienen tiempo de gestionar Instagram mientras atienden el local. Los datos son claros: los negocios con presencia activa en Instagram generan entre un 23% y un 40% más de visitas.</p><h2>Qué publicar y cuándo</h2><p>El contenido que más funciona: fotos de producto close-up, behind the scenes de la elaboración artesanal, novedades y temporadas, y clientes disfrutando. Los mejores momentos para publicar son los jueves y viernes entre las 17:00 y las 19:00, y los fines de semana por la mañana.</p><h2>El error que cometen todos</h2><p>El error más común es publicar de forma irregular. Una semana cinco posts, la siguiente ninguno. El algoritmo de Instagram penaliza la irregularidad y premia la consistencia. Lo ideal es mantener un ritmo de 4-5 publicaciones por semana. El segundo error es no responder comentarios.</p><h2>Cómo automatizarlo con IA</h2><p>Con NeuroPost puedes reducir la gestión semanal a 15 minutos: subes las fotos del día, la IA genera el caption con tu tono de marca, programa la publicación en el mejor horario y responde automáticamente los comentarios más frecuentes. El resultado: más consistencia, más engagement y más tiempo para centrarte en tu negocio.</p>`,
  },
  'mejores-horas-publicar': {
    title: 'Las mejores horas para publicar en Instagram (según el sector)',
    description: 'Analizamos miles de posts de negocios locales españoles para darte los horarios óptimos.',
    date: '20 de mayo de 2025', sector: 'General', readTime: '4 min',
    headings: ['Los datos detrás del análisis', 'Horarios por sector', 'El día de la semana importa', 'Adapta esto a tu audiencia'],
    content: `<h2>Los datos detrás del análisis</h2><p>Hemos analizado más de 50.000 publicaciones de negocios locales españoles en Instagram y Facebook durante los últimos 12 meses. Los horarios óptimos varían significativamente según el tipo de negocio, aunque hay patrones comunes. El factor más importante es la consistencia y la frecuencia.</p><h2>Horarios por sector</h2><p><strong>Restaurantes y cafeterías:</strong> 12:00-13:00 y 19:00-20:00. Los jueves y viernes son los mejores días.</p><p><strong>Heladerías y pastelerías:</strong> 16:00-18:00. Los fines de semana son especialmente buenos.</p><p><strong>Gimnasios:</strong> 6:00-8:00 y 19:00-21:00. Los lunes tienen picos de engagement.</p><p><strong>Boutiques y moda:</strong> 12:00-14:00 y 20:00-22:00. Los jueves destacan.</p><h2>El día de la semana importa</h2><p>Para hostelería: jueves y viernes son los mejores días. Para retail: miércoles y jueves. Para servicios: martes y miércoles. Los domingos son generalmente los peores días para publicar.</p><h2>Adapta esto a tu audiencia</h2><p>Estos son promedios. La mejor herramienta es tu propio historial. NeuroPost te da esta información de forma automática en el panel de analíticas, con recomendaciones específicas para tu negocio.</p>`,
  },
  'tendencias-redes-2025': {
    title: 'Tendencias en redes sociales para negocios locales en 2025',
    description: 'Lo que está funcionando ahora mismo en Instagram y Facebook para restaurantes, tiendas y servicios.',
    date: '10 de mayo de 2025', sector: 'General', readTime: '6 min',
    headings: ['El contenido auténtico gana', 'Los vídeos cortos siguen dominando', 'La IA como herramienta', 'Qué evitar en 2025'],
    content: `<h2>El contenido auténtico gana</h2><p>2025 es el año de la autenticidad. Los usuarios rechazan el contenido demasiado pulido y artificial. Para los negocios locales, esto es una buena noticia: la foto con el móvil de tu equipo preparando el plato especial del día genera más engagement que una fotografía de estudio perfecta. Los negocios que más han crecido este año muestran las personas detrás del negocio, los procesos reales, los momentos auténticos.</p><h2>Los vídeos cortos siguen dominando</h2><p>Los Reels de Instagram continúan siendo el formato con mayor alcance orgánico. Pero hay un cambio: la calidad técnica ya no es lo más importante. Lo que prima es la relevancia y la autenticidad. Un vídeo de 15 segundos mostrando cómo preparas un plato puede generar más visitas a tu perfil que un vídeo producido profesionalmente.</p><h2>La IA como herramienta</h2><p>Cada vez más negocios usan IA para generar captions, hashtags y planificar contenido. La tendencia que está marcando la diferencia es usar la IA para mantener el tono de marca de forma consistente, no para reemplazar la voz humana. El contenido que funciona usa la IA para la eficiencia pero mantiene la personalidad del negocio.</p><h2>Qué evitar en 2025</h2><p>El contenido de stock fotográfico genérico está hundido. Los hashtags en exceso (más de 5-7) han dejado de ayudar. Los posts promocionales sin valor añadido funcionan mal. La autenticidad, la consistencia y el valor real para tu audiencia son las tres claves para 2025.</p>`,
  },
};

export async function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) return { title: 'Artículo no encontrado — NeuroPost Blog' };
  return {
    title: `${article.title} — NeuroPost Blog`,
    description: article.description,
    openGraph: { title: article.title, description: article.description, type: 'article' },
    alternates: { canonical: `https://neuropost.es/blog/${slug}` },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = ARTICLES[slug];

  if (!article) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', paddingTop: 64 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", color: 'var(--orange)', marginBottom: 16 }}>Artículo no encontrado</h1>
          <Link href="/blog" style={{ color: 'var(--orange)', fontFamily: "'Cabinet Grotesk',sans-serif" }}>← Volver al blog</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(250,248,243,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" className="nav-logo"><span className="logo-dot" />NeuroPost</Link>
        <ul className="nav-links">
          <li><Link href="/blog" style={{ color: 'var(--muted)', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 500, textDecoration: 'none' }}>Blog</Link></li>
          <li><Link href="/login" className="nav-login">Iniciar sesión</Link></li>
          <li><Link href="/register" className="nav-cta">Empezar gratis</Link></li>
        </ul>
      </nav>

      <div style={{ paddingTop: 96, background: 'var(--cream)', minHeight: '100vh' }}>
        <div className="container" style={{ maxWidth: 1100 }}>
          <div style={{ paddingTop: 32, marginBottom: 32 }}>
            <Link href="/blog" style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--muted)', textDecoration: 'none' }}>← Blog</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 60, alignItems: 'start' }}>
            <article>
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span style={{ background: 'var(--orange-light)', color: 'var(--orange)', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.75rem', padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{article.sector}</span>
                  <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: 'var(--muted)' }}>{article.readTime} de lectura · {article.date}</span>
                </div>
                <h1 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', letterSpacing: '-0.03em', color: 'var(--ink)', lineHeight: 1.1, marginBottom: 20 }}>{article.title}</h1>
                <p style={{ fontSize: '1.1rem', color: 'var(--muted)', lineHeight: 1.7 }}>{article.description}</p>
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>P</div>
                  <div>
                    <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Equipo NeuroPost</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.78rem', color: 'var(--muted)' }}>Expertos en redes para negocios locales</div>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 40 }}>
                <div style={{ lineHeight: 1.8, color: 'var(--ink)', fontSize: '1rem' }}
                  dangerouslySetInnerHTML={{ __html: article.content
                    .replace(/<h2>/g, `<h2 style="font-family:'Cabinet Grotesk',sans-serif;font-weight:800;font-size:1.4rem;color:var(--ink);margin:40px 0 16px;letter-spacing:-0.02em">`)
                    .replace(/<p>/g, `<p style="margin-bottom:16px;color:var(--muted);line-height:1.8">`)
                  }}
                />
              </div>
              <div style={{ marginTop: 64, background: 'var(--ink)', borderRadius: 20, padding: '40px 36px', textAlign: 'center' }}>
                <h3 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 900, fontSize: '1.4rem', color: 'white', marginBottom: 12, letterSpacing: '-0.03em' }}>¿Quieres que llevemos las redes de tu negocio?</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 24 }}>14 días gratis. Sin tarjeta de crédito.</p>
                <Link href="/register" style={{ display: 'inline-block', background: 'var(--orange)', color: 'white', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, padding: '14px 32px', borderRadius: 40, textDecoration: 'none', fontSize: '0.95rem' }}>Empezar gratis →</Link>
              </div>
            </article>
            <aside style={{ position: 'sticky', top: 96 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>En este artículo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {article.headings.map((h, i) => (
                    <span key={i} style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.4 }}>{h}</span>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--orange-light)', border: '1px solid rgba(255,92,26,0.2)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 8 }}>Automatiza tu Instagram</div>
                <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: 14 }}>14 días gratis para ver los resultados.</p>
                <Link href="/register" style={{ display: 'block', textAlign: 'center', background: 'var(--orange)', color: 'white', fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 700, padding: '10px 16px', borderRadius: 40, textDecoration: 'none', fontSize: '0.85rem' }}>Probar gratis →</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <footer>
        <div className="container">
          <div className="footer-bottom">
            <span>© 2025 NeuroPost · Todos los derechos reservados</span>
            <Link href="/blog" style={{ color: 'rgba(250,248,243,0.5)', textDecoration: 'none', fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '0.85rem' }}>← Volver al blog</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
