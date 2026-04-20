'use client';

/**
 * Step6BriefAvanzado.tsx — v2 (rediseño visual + copy humanizado)
 */

import { useState, useMemo, useCallback } from 'react';
import type { SocialSector } from '@/types';

// ─── Tipos (idénticos a v1) ──────────────────────────────────────────────────
export type BriefProduct = {
  id: string;
  name: string;
  category?: string;
  price_cents?: number;
  currency?: 'EUR' | 'USD' | 'MXN' | 'ARS' | 'COP' | 'CLP';
  main_benefit?: string;
  description?: string;
  is_hero?: boolean;
};

export type BriefPersona = {
  id: string;
  persona_name: string;
  age_range?: string;
  gender?: string;
  lifestyle?: string;
  pains: string[];
  desires: string[];
  objections?: string[];
  buying_trigger?: string;
  lingo_yes: string[];
  lingo_no: string[];
};

export type BriefCompetitor = {
  id: string;
  name: string;
  ig_handle?: string;
  comment?: string;
  is_direct_competitor: boolean;
  is_reference: boolean;
  is_anti_reference: boolean;
};

export type BriefFaq = {
  id: string;
  category:
    | 'precio' | 'horario' | 'ubicacion' | 'reserva'
    | 'devolucion' | 'producto' | 'servicio' | 'envio'
    | 'pago' | 'otro';
  question: string;
  answer: string;
};

export type BriefState = {
  products: BriefProduct[];
  personas: BriefPersona[];
  competitors: BriefCompetitor[];
  faqs: BriefFaq[];
  compliance_flags: Record<string, unknown>;
};

export const emptyBriefState = (): BriefState => ({
  products: [], personas: [], competitors: [], faqs: [], compliance_flags: {},
});

// ─── Design tokens ───────────────────────────────────────────────────────────
const ACCENT   = '#0F766E';
const ACCENT_D = '#0a5249';
const INK      = '#111827';
const MUTED    = '#6b7280';
const MUTED_2  = '#9ca3af';
const BORDER   = '#e5e7eb';
const BORDER_2 = '#d4d4d8';
const SOFT     = '#f9fafb';
const SUCCESS  = '#059669';
const SUCCESS_BG = '#ecfdf5';
const WARN     = '#d97706';
const WARN_BG  = '#fef3c7';
const DANGER   = '#dc2626';
const DANGER_BG = '#fef2f2';
const FONT   = "var(--font-barlow), 'Barlow', sans-serif";
const FONT_C = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#ffffff',
  border: `1px solid ${BORDER_2}`, borderRadius: 0, color: INK,
  fontFamily: FONT, fontSize: '0.88rem', outline: 'none',
  transition: 'border-color 0.15s', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, padding: '12px 36px 12px 14px',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  backgroundSize: 14, cursor: 'pointer',
};

// ─── Iconos SVG minimalistas (line, 20px) ────────────────────────────────────
const svgProps = {
  width: 20, height: 20, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor' as const,
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

const IconChat = () => (
  <svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const IconStar = () => (
  <svg {...svgProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);
const IconShield = () => (
  <svg {...svgProps}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const IconUsers = () => (
  <svg {...svgProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconCompass = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
);
const IconSparkle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/></svg>
);

// ─── Sugerencias de FAQ por sector ───────────────────────────────────────────
const FAQ_SUGGESTIONS_BY_SECTOR: Partial<Record<SocialSector, BriefFaq[]>> = {
  restaurante: [
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'Abrimos de martes a domingo de 13:00 a 16:00 y de 20:00 a 23:30. Lunes cerrado.' },
    { id: '', category: 'reserva',   question: '¿Se puede reservar?',               answer: 'Sí, puedes reservar por WhatsApp, teléfono o desde nuestra web.' },
    { id: '', category: 'precio',    question: '¿Tenéis menú del día?',             answer: 'Sí, menú del día de martes a viernes a 18€ con entrante, principal, postre y bebida.' },
    { id: '', category: 'producto',  question: '¿Tenéis opciones sin gluten?',      answer: 'Sí, toda nuestra carta indica los alérgenos. Tenemos varios platos sin gluten certificados.' },
    { id: '', category: 'producto',  question: '¿Tenéis opciones veganas?',         answer: 'Sí, tenemos platos veganos y podemos adaptar varios platos bajo pedido.' },
    { id: '', category: 'ubicacion', question: '¿Dónde estáis?',                    answer: 'Estamos en [dirección]. Hay parking público a 2 minutos.' },
    { id: '', category: 'pago',      question: '¿Aceptáis tarjeta?',                answer: 'Sí, aceptamos tarjeta, Bizum y efectivo.' },
  ],
  heladeria: [
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'Abrimos todos los días de 11:00 a 23:00 en temporada.' },
    { id: '', category: 'producto',  question: '¿Tenéis helados sin lactosa?',      answer: 'Sí, tenemos una selección de sorbetes y helados veganos sin lactosa.' },
    { id: '', category: 'producto',  question: '¿Tenéis tartas heladas por encargo?', answer: 'Sí, con 48h de antelación. Pídela por DM o WhatsApp.' },
    { id: '', category: 'precio',    question: '¿Cuánto cuesta una tarrina?',       answer: 'Desde 3,50€ la pequeña. Tenemos tamaños small, medium y large.' },
    { id: '', category: 'ubicacion', question: '¿Hacéis envío a domicilio?',        answer: 'Estamos disponibles en Glovo y Uber Eats en la zona.' },
  ],
  cafeteria: [
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'Abrimos de lunes a viernes de 8:00 a 20:00 y sábados y domingos de 9:00 a 21:00.' },
    { id: '', category: 'producto',  question: '¿Servís brunch?',                   answer: 'Sí, brunch todos los fines de semana de 10:00 a 14:00.' },
    { id: '', category: 'producto',  question: '¿Tenéis leche de avena / soja / almendra?', answer: 'Sí, todas disponibles sin coste adicional.' },
    { id: '', category: 'reserva',   question: '¿Se puede reservar mesa?',          answer: 'Solo para grupos de más de 4. Para 1-4 personas es por orden de llegada.' },
    { id: '', category: 'pago',      question: '¿Aceptáis tarjeta?',                answer: 'Sí, tarjeta y Bizum.' },
  ],
  gym: [
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'Abrimos de lunes a viernes de 6:30 a 22:30 y fines de semana de 9:00 a 14:00.' },
    { id: '', category: 'precio',    question: '¿Cuánto cuesta la cuota?',          answer: 'Cuota mensual desde 39€/mes. Consulta nuestros planes por DM.' },
    { id: '', category: 'servicio',  question: '¿Tenéis entrenador personal?',      answer: 'Sí, sesiones desde 35€. Contáctanos para más info.' },
    { id: '', category: 'servicio',  question: '¿Qué clases dirigidas tenéis?',     answer: 'Crossfit, funcional, spinning, yoga, pilates y boxeo. Horario en nuestra web.' },
    { id: '', category: 'otro',      question: '¿Puedo hacer una clase de prueba?', answer: '¡Claro! Primera clase gratuita. Reserva por DM.' },
  ],
  clinica: [
    { id: '', category: 'reserva',   question: '¿Cómo pido cita?',                  answer: 'Puedes pedir cita por teléfono, WhatsApp o desde nuestra web.' },
    { id: '', category: 'precio',    question: '¿Cuánto cuesta la primera consulta?', answer: 'Consúltanos por DM. El precio depende del tratamiento.' },
    { id: '', category: 'otro',      question: '¿Trabajáis con mutuas?',            answer: 'Sí, trabajamos con las principales. Consúltanos las que tenemos activas.' },
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'De lunes a viernes de 9:00 a 20:00. Sábados por la mañana con cita.' },
  ],
  clinica_estetica: [
    { id: '', category: 'reserva',   question: '¿Hacéis consulta de valoración gratuita?', answer: 'Sí, primera consulta de valoración sin compromiso.' },
    { id: '', category: 'precio',    question: '¿Cuánto cuestan los tratamientos?', answer: 'El precio depende del tratamiento y zona. En la consulta te damos un presupuesto personalizado.' },
    { id: '', category: 'otro',      question: '¿Puedo financiar el tratamiento?',  answer: 'Sí, ofrecemos financiación en varios plazos sin intereses.' },
    { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',         answer: 'De lunes a viernes de 10:00 a 20:00. Sábados con cita previa.' },
  ],
  dental: [
    { id: '', category: 'reserva',   question: '¿Hacéis primera visita gratuita?',  answer: 'Sí, primera visita, revisión y diagnóstico sin compromiso.' },
    { id: '', category: 'precio',    question: '¿Trabajáis con seguros dentales?',  answer: 'Sí, consulta los seguros con los que colaboramos.' },
    { id: '', category: 'otro',      question: '¿Ofrecéis financiación?',           answer: 'Sí, hasta 24 meses sin intereses en ortodoncia e implantes.' },
  ],
  barberia: [
    { id: '', category: 'reserva',   question: '¿Cómo pido cita?',                  answer: 'Reserva por DM, WhatsApp o desde nuestra app/web.' },
    { id: '', category: 'precio',    question: '¿Cuánto cuesta un corte?',          answer: 'Corte desde 15€. Corte + barba desde 22€.' },
    { id: '', category: 'horario',   question: '¿Abrís los sábados?',               answer: 'Sí, abrimos sábados de 10:00 a 20:00 sin interrupción.' },
  ],
  boutique: [
    { id: '', category: 'envio',     question: '¿Hacéis envíos a domicilio?',       answer: 'Sí, envío gratis a partir de 60€.' },
    { id: '', category: 'devolucion', question: '¿Puedo devolver la compra?',       answer: '30 días para devolver. Sin usar y con etiqueta.' },
    { id: '', category: 'producto',  question: '¿Tenéis tallas grandes?',           answer: 'Sí, de la XS a la XXL en la mayoría de referencias.' },
    { id: '', category: 'otro',      question: '¿Puedo reservar una prenda?',       answer: 'Reservamos hasta 24h por DM.' },
  ],
  inmobiliaria: [
    { id: '', category: 'otro',      question: '¿Cobráis comisión al comprador?',   answer: 'No, nuestra comisión la paga el vendedor.' },
    { id: '', category: 'reserva',   question: '¿Cómo pido una visita?',            answer: 'Por DM, WhatsApp o desde la ficha del inmueble.' },
    { id: '', category: 'servicio',  question: '¿Ayudáis con la hipoteca?',         answer: 'Sí, trabajamos con un bróker hipotecario sin coste para ti.' },
  ],
  yoga: [
    { id: '', category: 'precio',    question: '¿Cuánto cuesta una clase?',         answer: 'Clase suelta 15€. Bono 10 clases 120€. Mensual ilimitado desde 80€.' },
    { id: '', category: 'otro',      question: '¿Se puede probar una clase?',       answer: 'Sí, primera clase gratuita. Reserva por DM.' },
    { id: '', category: 'servicio',  question: '¿Qué tipos de yoga tenéis?',        answer: 'Hatha, vinyasa, yin, prenatal y meditación.' },
  ],
};

const GENERIC_FAQS: BriefFaq[] = [
  { id: '', category: 'horario',   question: '¿Cuál es vuestro horario?',      answer: 'Abrimos de lunes a viernes de [hora] a [hora].' },
  { id: '', category: 'ubicacion', question: '¿Dónde estáis?',                  answer: 'Estamos en [dirección]. Puedes ver cómo llegar en el link de nuestra bio.' },
  { id: '', category: 'reserva',   question: '¿Cómo pido cita / reservo?',      answer: 'Por DM, WhatsApp o desde nuestra web.' },
  { id: '', category: 'pago',      question: '¿Qué formas de pago aceptáis?',   answer: 'Tarjeta, Bizum y efectivo.' },
  { id: '', category: 'otro',      question: '¿Puedo contactaros por WhatsApp?', answer: 'Sí, nuestro WhatsApp es [número].' },
];

// ─── Preguntas de compliance por sector ──────────────────────────────────────
type ComplianceQuestion = {
  key: string;
  label: string;
  type: 'toggle' | 'radio';
  options?: { value: string; label: string }[];
  help?: string;
  danger?: boolean;
};

const HEALTHCARE_Q: ComplianceQuestion[] = [
  { key: 'requires_sanitary_disclaimer', label: 'Mi negocio es sanitario y necesita disclaimers', type: 'toggle', help: 'Lo marca el código deontológico — importante.' },
  { key: 'shows_before_after', label: '¿Mostramos fotos antes/después?', type: 'radio',
    options: [
      { value: 'no',              label: 'No' },
      { value: 'with_disclaimer', label: 'Sí, con aviso "resultados varían"' },
      { value: 'yes',             label: 'Sí, sin aviso' },
    ], help: 'Si eliges "sin aviso" lo revisamos a mano antes de publicar.' },
  { key: 'mentions_prices', label: '¿Podemos mencionar precios de tratamientos?', type: 'toggle' },
];
const FOOD_Q: ComplianceQuestion[] = [
  { key: 'shows_allergens',   label: 'Mostramos alérgenos en los posts de producto', type: 'toggle', help: 'Obligatorio en UE si hay alérgenos principales.' },
  { key: 'price_list_public', label: 'La carta de precios es pública',               type: 'toggle' },
  { key: 'alcohol_content',   label: 'Publicamos contenido con alcohol',             type: 'toggle', help: 'Activa restricciones de Meta por edad y países.' },
];
const FITNESS_Q: ComplianceQuestion[] = [
  { key: 'promises_physical_results', label: 'Prometemos resultados físicos concretos (ej: "pierde 5kg")', type: 'toggle', danger: true, help: 'Mejor NO — Meta y la ley publicitaria lo sancionan.' },
  { key: 'nutrition_claims', label: 'Hacemos afirmaciones nutricionales', type: 'toggle', help: 'Si sí, lo pasamos por un revisor humano antes de publicar.' },
];
const LEGAL_Q: ComplianceQuestion[] = [
  { key: 'shows_real_cases', label: 'Mostramos casos reales o cifras de éxito', type: 'toggle', danger: true, help: 'Mejor NO — secreto profesional y código deontológico.' },
  { key: 'mentions_fees',    label: 'Podemos mencionar honorarios',             type: 'toggle' },
];
const REAL_ESTATE_Q: ComplianceQuestion[] = [
  { key: 'shows_prices', label: 'Mostramos precios de los inmuebles',  type: 'toggle' },
  { key: 'promises_roi', label: 'Prometemos rentabilidad garantizada', type: 'toggle', danger: true, help: 'Mejor NO — regulación CNMV.' },
];
const GENERIC_Q: ComplianceQuestion[] = [
  { key: 'people_can_appear',           label: 'Pueden aparecer empleados o clientes reales en el contenido', type: 'toggle' },
  { key: 'has_signed_image_consents',   label: 'Tengo consentimientos de imagen firmados de quienes aparecen', type: 'toggle', help: 'Necesario por RGPD.' },
  { key: 'allows_ai_generated_imagery', label: 'Podemos usar imágenes generadas a partir de tus referencias', type: 'toggle', help: 'Si no, solo usamos material tuyo.' },
];

function getComplianceQuestions(sector: SocialSector): {
  sector_specific: ComplianceQuestion[]; generic: ComplianceQuestion[];
} {
  const healthcare = ['clinica', 'clinica_estetica', 'dental', 'psicologia', 'fisioterapia', 'nutricion', 'veterinario'];
  const food       = ['restaurante', 'cafeteria', 'heladeria', 'cocteleria', 'panaderia', 'street_food', 'vinoteca', 'catering'];
  const fitness    = ['gym', 'yoga', 'centro_deportivo', 'club_deportivo', 'academia_deporte'];
  const legal      = ['abogado', 'consultoria'];
  const realEstate = ['inmobiliaria', 'inmobiliaria_lujo', 'reformas', 'arquitectura'];

  if (healthcare.includes(sector))  return { sector_specific: HEALTHCARE_Q,  generic: GENERIC_Q };
  if (food.includes(sector))        return { sector_specific: FOOD_Q,        generic: GENERIC_Q };
  if (fitness.includes(sector))     return { sector_specific: FITNESS_Q,     generic: GENERIC_Q };
  if (legal.includes(sector))       return { sector_specific: LEGAL_Q,       generic: GENERIC_Q };
  if (realEstate.includes(sector))  return { sector_specific: REAL_ESTATE_Q, generic: GENERIC_Q };
  return { sector_specific: [], generic: GENERIC_Q };
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, fontFamily: FONT }}>
      {children}
      {optional && <span style={{ opacity: 0.5, marginLeft: 6, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>opcional</span>}
    </div>
  );
}

function TagInput({
  values, onChange, placeholder, color = ACCENT,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string; color?: string }) {
  const remove = (v: string) => onChange(values.filter(x => x !== v));
  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {values.map((v) => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 8px 5px 10px', background: color, color: '#ffffff',
              fontFamily: FONT, fontSize: '0.76rem', fontWeight: 700,
            }}>
              {v}
              <button type="button" onClick={() => remove(v)} style={{
                background: 'transparent', border: 'none', color: '#ffffff',
                cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        style={inputStyle}
        type="text"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const t = e.target as HTMLInputElement;
            const newValues = t.value.split(/[,]/).map(s => s.trim()).filter(Boolean).filter(v => !values.includes(v));
            if (newValues.length) onChange([...values, ...newValues]);
            t.value = '';
          }
        }}
        onBlur={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.value.trim()) {
            const newValues = t.value.split(/[,]/).map(s => s.trim()).filter(Boolean).filter(v => !values.includes(v));
            if (newValues.length) onChange([...values, ...newValues]);
            t.value = '';
          }
        }}
      />
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

type SectionProps = {
  id: string;
  index: string;
  icon: React.ReactNode;
  title: string;
  humanLine: string;
  progress: number;
  itemsLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function SectionCard({ id, index, icon, title, humanLine, progress, itemsLabel, isOpen, onToggle, children }: SectionProps) {
  const completed = progress >= 100;
  const cardBg = completed ? SUCCESS_BG : '#ffffff';
  const borderColor = completed ? SUCCESS : (isOpen ? ACCENT : BORDER);

  return (
    <section style={{
      background: cardBg, border: `1.5px solid ${borderColor}`,
      marginBottom: 12, transition: 'border-color 0.2s, background 0.2s',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', padding: '20px 22px', background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 18,
        }}
        aria-expanded={isOpen}
        aria-controls={`section-${id}`}
      >
        <div style={{
          flexShrink: 0, width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: completed ? SUCCESS : (isOpen ? ACCENT : '#ffffff'),
          border: completed ? `1.5px solid ${SUCCESS}` : (isOpen ? `1.5px solid ${ACCENT}` : `1.5px solid ${BORDER_2}`),
          color: (completed || isOpen) ? '#ffffff' : INK,
          transition: 'all 0.2s',
        }}>
          {completed ? (
            <IconCheck />
          ) : (
            <span style={{ fontFamily: FONT_C, fontWeight: 900, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
              {index}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: completed ? SUCCESS : ACCENT, display: 'inline-flex' }}>{icon}</span>
            <span style={{
              fontFamily: FONT_C, fontWeight: 900, fontSize: '1.08rem',
              color: INK, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1,
            }}>
              {title}
            </span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginLeft: 30, lineHeight: 1.45 }}>
            {humanLine}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 110 }}>
          <div style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700,
            color: completed ? SUCCESS : MUTED, whiteSpace: 'nowrap',
          }}>
            {itemsLabel}
          </div>
          <div style={{ width: 90, height: 4, background: '#f3f4f6', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${progress}%`,
              background: completed ? SUCCESS : ACCENT, transition: 'width 0.3s',
            }} />
          </div>
        </div>

        <span style={{ color: MUTED, display: 'inline-flex', marginLeft: 6 }}>
          <IconChevron open={isOpen} />
        </span>
      </button>

      {isOpen && (
        <div id={`section-${id}`} style={{
          padding: '8px 22px 22px',
          borderTop: `1px solid ${completed ? '#d1fae5' : BORDER}`,
        }}>
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Mensaje emocional según % ───────────────────────────────────────────────
function getQualityMessage(pct: number): { label: string; color: string; emoji: string } {
  if (pct === 0)  return { label: 'Aún no empezaste',           color: MUTED_2, emoji: '' };
  if (pct < 30)   return { label: 'Estamos arrancando',         color: MUTED,   emoji: '' };
  if (pct < 60)   return { label: 'Vamos bien',                 color: WARN,    emoji: '' };
  if (pct < 90)   return { label: '¡Ya sabemos mucho de ti!',   color: ACCENT,  emoji: '' };
  return            { label: '¡Perfecto, listos para escribir!', color: SUCCESS, emoji: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function Step6BriefAvanzado({
  sector, brief, setBrief, onContinue, onSkip,
}: {
  sector: SocialSector;
  brief: BriefState;
  setBrief: React.Dispatch<React.SetStateAction<BriefState>>;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [openSections, setOpenSections] = useState<string[]>(['faqs']);
  const toggle = useCallback((id: string) => {
    setOpenSections((prev) => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }, []);

  const { products, personas, competitors, faqs, compliance_flags } = brief;
  const complianceQs = useMemo(() => getComplianceQuestions(sector), [sector]);

  const productsPct    = Math.min(100, Math.round((products.length / 3) * 100));
  const faqsPct        = Math.min(100, Math.round((faqs.length / 5) * 100));
  const personasPct    = personas.length >= 1 ? 100 : 0;
  const competitorsPct = Math.min(100, Math.round((competitors.length / 2) * 100));
  const compliancePct  = (() => {
    const total = complianceQs.sector_specific.length + complianceQs.generic.length;
    if (!total) return 100;
    return Math.min(100, Math.round((Object.keys(compliance_flags).length / total) * 100));
  })();

  const overallPct = Math.round(
    faqsPct * 0.40 + productsPct * 0.30 + compliancePct * 0.15 +
    personasPct * 0.10 + competitorsPct * 0.05
  );
  const msg = getQualityMessage(overallPct);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* HERO HEADER */}
      <div style={{ marginBottom: 22 }}>
        <div style={{
          fontFamily: FONT_C, fontWeight: 900,
          fontSize: 'clamp(1.5rem, 3.2vw, 2rem)',
          color: INK, letterSpacing: '0.01em', textTransform: 'uppercase',
          marginBottom: 8, lineHeight: 1.0,
        }}>
          Conozcámonos mejor
        </div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED, lineHeight: 1.6, maxWidth: 560 }}>
          Cuanto mejor te conozcamos, más preciso será lo que escribimos por ti.
          Esto nos lleva 5 minutos y cambia por completo la calidad de tu contenido.
        </div>
      </div>

      {/* QUALITY BAR */}
      <div style={{
        padding: '14px 18px', background: '#ffffff', border: `1px solid ${BORDER}`,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: INK }}>
              {msg.label}
            </div>
            <div style={{ fontFamily: FONT_C, fontSize: 14, fontWeight: 900, color: msg.color, letterSpacing: '-0.01em' }}>
              {overallPct}%
            </div>
          </div>
          <div style={{ height: 6, background: '#f3f4f6', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${overallPct}%`,
              background: msg.color, transition: 'width 0.4s, background 0.3s',
            }} />
          </div>
        </div>
      </div>

      {/* SCROLLABLE SECTIONS */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 16 }}>

        <SectionCard
          id="faqs" index="01" icon={<IconChat />}
          title="Las preguntas que más te hacen"
          humanLine="Tus clientes repiten preguntas. Guárdalas con tu respuesta real y respondemos igual que responderías tú."
          progress={faqsPct}
          itemsLabel={faqs.length === 0 ? 'Sin añadir' : `${faqs.length} ${faqs.length === 1 ? 'pregunta' : 'preguntas'}`}
          isOpen={openSections.includes('faqs')}
          onToggle={() => toggle('faqs')}
        >
          <FaqsEditor sector={sector} faqs={faqs} setFaqs={(next) => setBrief(prev => ({ ...prev, faqs: next }))} />
        </SectionCard>

        <SectionCard
          id="products" index="02" icon={<IconStar />}
          title="Lo que vale la pena destacar"
          humanLine="Los productos o servicios que más quieres empujar. Los destacados salen más veces en tu feed."
          progress={productsPct}
          itemsLabel={products.length === 0 ? 'Sin añadir' : `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`}
          isOpen={openSections.includes('products')}
          onToggle={() => toggle('products')}
        >
          <ProductsEditor products={products} setProducts={(next) => setBrief(prev => ({ ...prev, products: next }))} />
        </SectionCard>

        <SectionCard
          id="personas" index="03" icon={<IconUsers />}
          title="A quién le hablas"
          humanLine="Tu cliente ideal en 3 líneas. Así el copy habla su mismo idioma en vez de sonar genérico."
          progress={personasPct}
          itemsLabel={personas.length === 0 ? 'Sin añadir' : `${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}`}
          isOpen={openSections.includes('personas')}
          onToggle={() => toggle('personas')}
        >
          <PersonasEditor personas={personas} setPersonas={(next) => setBrief(prev => ({ ...prev, personas: next }))} />
        </SectionCard>

        <SectionCard
          id="compliance" index="04" icon={<IconShield />}
          title="Tus reglas del juego"
          humanLine="Tu sector tiene normas especiales. Dinos qué respetar y qué nunca publicar."
          progress={compliancePct}
          itemsLabel={`${Object.keys(compliance_flags).length} respondidas`}
          isOpen={openSections.includes('compliance')}
          onToggle={() => toggle('compliance')}
        >
          <ComplianceEditor
            sector={sector} flags={compliance_flags}
            setFlags={(next) => setBrief(prev => ({ ...prev, compliance_flags: next }))}
          />
        </SectionCard>

        <SectionCard
          id="competitors" index="05" icon={<IconCompass />}
          title="Cuentas que admiras (y cuentas que no)"
          humanLine="Las dos cosas nos sirven: para diferenciarte de tu competencia y para inspirarnos con quien hace bien el trabajo."
          progress={competitorsPct}
          itemsLabel={competitors.length === 0 ? 'Sin añadir' : `${competitors.length} ${competitors.length === 1 ? 'cuenta' : 'cuentas'}`}
          isOpen={openSections.includes('competitors')}
          onToggle={() => toggle('competitors')}
        >
          <CompetitorsEditor competitors={competitors} setCompetitors={(next) => setBrief(prev => ({ ...prev, competitors: next }))} />
        </SectionCard>

      </div>

      {/* FOOTER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: '14px 32px', borderRadius: 0, background: INK, color: '#ffffff',
            border: 'none', cursor: 'pointer', fontFamily: FONT_C, fontWeight: 700,
            fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em',
            flex: '0 0 auto',
          }}
        >
          Continuar al pago →
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            padding: 0, background: 'transparent', border: 'none',
            color: MUTED, cursor: 'pointer', fontFamily: FONT, fontSize: 13,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Prefiero completar esto después
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDITORES REDISEÑADOS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. FAQs — mockup tipo chat ───────────────────────────────────────────────

function FaqsEditor({
  sector, faqs, setFaqs,
}: { sector: SocialSector; faqs: BriefFaq[]; setFaqs: (f: BriefFaq[]) => void }) {
  const suggestions = FAQ_SUGGESTIONS_BY_SECTOR[sector] ?? GENERIC_FAQS;
  const availableSuggestions = suggestions.filter(s => !faqs.some(f => f.question === s.question));

  const addAll   = () => setFaqs([...faqs, ...availableSuggestions.map(s => ({ ...s, id: crypto.randomUUID() }))]);
  const addOne   = (s: BriefFaq) => setFaqs([...faqs, { ...s, id: crypto.randomUUID() }]);
  const addBlank = () => setFaqs([...faqs, { id: crypto.randomUUID(), category: 'otro', question: '', answer: '' }]);
  const update   = (id: string, patch: Partial<BriefFaq>) =>
    setFaqs(faqs.map(f => f.id === id ? { ...f, ...patch } : f));
  const remove   = (id: string) => setFaqs(faqs.filter(f => f.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {availableSuggestions.length > 0 && (
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)',
          border: `1px solid ${ACCENT}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ACCENT, marginBottom: 10 }}>
            <IconSparkle />
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
              Las {availableSuggestions.length} más comunes en tu sector
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {availableSuggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addOne(s)}
                style={{
                  padding: '6px 11px', background: '#ffffff', border: `1px solid ${ACCENT}`,
                  color: ACCENT, fontFamily: FONT, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <IconPlus /> {s.question.length > 38 ? s.question.slice(0, 38) + '…' : s.question}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={addAll}
            style={{
              padding: '9px 16px', background: ACCENT, border: 'none', color: '#ffffff',
              fontFamily: FONT_C, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', cursor: 'pointer',
            }}
          >
            Añadir las {availableSuggestions.length} de golpe →
          </button>
        </div>
      )}

      {faqs.map((f) => (
        <div key={f.id} style={{
          border: `1px solid ${BORDER}`, background: '#ffffff',
          padding: '16px', position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <select
              style={{
                ...selectStyle, width: 'auto', padding: '6px 28px 6px 10px',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: MUTED,
              }}
              value={f.category}
              onChange={(e) => update(f.id, { category: e.target.value as BriefFaq['category'] })}
            >
              <option value="precio">Precio</option>
              <option value="horario">Horario</option>
              <option value="ubicacion">Ubicación</option>
              <option value="reserva">Reserva</option>
              <option value="devolucion">Devolución</option>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="envio">Envío</option>
              <option value="pago">Pago</option>
              <option value="otro">Otro</option>
            </select>
            <div style={{ flex: 1 }} />
            <button
              type="button" onClick={() => remove(f.id)}
              style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: MUTED_2, cursor: 'pointer', display: 'inline-flex' }}
              aria-label="Eliminar"
            ><IconTrash /></button>
          </div>

          {/* Pregunta — burbuja gris izquierda */}
          <div style={{ display: 'flex', marginBottom: 8 }}>
            <div style={{
              maxWidth: '85%', background: '#f3f4f6',
              padding: '10px 14px', borderRadius: '14px 14px 14px 2px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Lo que te preguntan
              </div>
              <input
                type="text"
                placeholder="¿Cuál es vuestro horario?"
                value={f.question}
                onChange={(e) => update(f.id, { question: e.target.value })}
                style={{
                  width: '100%', border: 'none', background: 'transparent',
                  outline: 'none', fontFamily: FONT, fontSize: 14, color: INK, fontWeight: 500,
                }}
              />
            </div>
          </div>

          {/* Respuesta — burbuja teal derecha */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              maxWidth: '85%', background: ACCENT, color: '#ffffff',
              padding: '10px 14px', borderRadius: '14px 14px 2px 14px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.8, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Cómo respondemos
              </div>
              <textarea
                placeholder="Escribe exactamente cómo quieres que respondamos..."
                value={f.answer}
                onChange={(e) => update(f.id, { answer: e.target.value })}
                rows={2}
                style={{
                  width: '100%', border: 'none', background: 'transparent',
                  outline: 'none', fontFamily: FONT, fontSize: 14, color: '#ffffff',
                  resize: 'vertical', minHeight: 40,
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBlank}
        style={{
          padding: '12px 16px', background: '#ffffff', border: `1px dashed ${BORDER_2}`,
          color: INK, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <IconPlus /> Añadir una pregunta nueva
      </button>

      {faqs.length > 0 && faqs.length < 5 && (
        <div style={{
          padding: '10px 14px', background: WARN_BG, border: `1px solid #fde68a`,
          fontFamily: FONT, fontSize: 12, color: '#78350f', lineHeight: 1.5,
        }}>
          Con 5 preguntas ya podemos responder la mayoría de DMs por ti sin tener que preguntarte nada.
        </div>
      )}
    </div>
  );
}

// ─── 2. Productos — cards tipo catálogo ──────────────────────────────────────

function ProductsEditor({
  products, setProducts,
}: { products: BriefProduct[]; setProducts: (p: BriefProduct[]) => void }) {
  const add = () => {
    setProducts([...products, {
      id: crypto.randomUUID(), name: '', main_benefit: '',
      is_hero: products.length === 0, currency: 'EUR',
    }]);
  };
  const update = (id: string, patch: Partial<BriefProduct>) =>
    setProducts(products.map(p => p.id === id ? { ...p, ...patch } : p));
  const remove = (id: string) => setProducts(products.filter(p => p.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {products.map((p) => (
        <div key={p.id} style={{
          display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 14,
          padding: 14, background: '#ffffff', border: `1px solid ${BORDER}`,
          alignItems: 'start',
        }}>
          {/* Placeholder visual */}
          <div style={{
            width: 96, height: 96, background: p.is_hero ? ACCENT : SOFT,
            border: p.is_hero ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {p.is_hero ? (
              <span style={{ color: '#ffffff' }}><IconStar /></span>
            ) : (
              <span style={{ fontFamily: FONT_C, fontSize: '2.2rem', fontWeight: 900, color: MUTED_2, letterSpacing: '-0.03em' }}>
                {p.name ? p.name[0].toUpperCase() : '—'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <input
              style={{ ...inputStyle, padding: '10px 0', border: 'none', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}
              type="text"
              placeholder="Nombre del producto o servicio"
              value={p.name}
              onChange={(e) => update(p.id, { name: e.target.value })}
            />
            <input
              style={{ ...inputStyle, padding: '6px 0', border: 'none', fontSize: '0.86rem', color: MUTED, fontStyle: 'italic' }}
              type="text"
              placeholder="Beneficio: por qué alguien lo contrata (en una línea)"
              value={p.main_benefit ?? ''}
              onChange={(e) => update(p.id, { main_benefit: e.target.value })}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${BORDER_2}`, paddingRight: 6 }}>
                <input
                  style={{ ...inputStyle, border: 'none', width: 70, padding: '6px 10px', fontSize: 14, fontWeight: 700 }}
                  type="number"
                  placeholder="0"
                  value={p.price_cents ? p.price_cents / 100 : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(p.id, { price_cents: v ? Math.round(parseFloat(v) * 100) : undefined });
                  }}
                />
                <select
                  style={{ border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 12, fontWeight: 700, color: MUTED, cursor: 'pointer', outline: 'none' }}
                  value={p.currency ?? 'EUR'}
                  onChange={(e) => update(p.id, { currency: e.target.value as BriefProduct['currency'] })}
                >
                  <option value="EUR">€</option>
                  <option value="USD">$</option>
                  <option value="MXN">MX$</option>
                  <option value="ARS">AR$</option>
                  <option value="COP">CO$</option>
                  <option value="CLP">CL$</option>
                </select>
              </div>

              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', cursor: 'pointer',
                background: p.is_hero ? ACCENT : '#ffffff',
                color: p.is_hero ? '#ffffff' : MUTED,
                border: `1px solid ${p.is_hero ? ACCENT : BORDER_2}`,
                fontFamily: FONT, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}>
                <input
                  type="checkbox"
                  checked={!!p.is_hero}
                  onChange={(e) => update(p.id, { is_hero: e.target.checked })}
                  style={{ display: 'none' }}
                />
                <span style={{ display: 'inline-flex' }}><IconStar /></span>
                Destacado
              </label>
            </div>
          </div>

          <button
            type="button" onClick={() => remove(p.id)}
            style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: MUTED_2, cursor: 'pointer', display: 'inline-flex', alignSelf: 'start' }}
            aria-label="Eliminar"
          ><IconTrash /></button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        style={{
          padding: '14px 16px', background: '#ffffff', border: `1px dashed ${BORDER_2}`,
          color: INK, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <IconPlus /> Añadir producto o servicio
      </button>

      {products.length > 0 && products.length < 3 && (
        <div style={{
          padding: '10px 14px', background: WARN_BG, border: `1px solid #fde68a`,
          fontFamily: FONT, fontSize: 12, color: '#78350f', lineHeight: 1.5,
        }}>
          Con 3 productos podemos variar el contenido y no repetir siempre lo mismo.
        </div>
      )}
    </div>
  );
}

// ─── 3. Personas — avatar + chips de color ───────────────────────────────────

function PersonasEditor({
  personas, setPersonas,
}: { personas: BriefPersona[]; setPersonas: (p: BriefPersona[]) => void }) {
  const add = () => {
    if (personas.length >= 3) return;
    setPersonas([...personas, {
      id: crypto.randomUUID(), persona_name: '',
      pains: [], desires: [], lingo_yes: [], lingo_no: [],
    }]);
  };
  const update = (id: string, patch: Partial<BriefPersona>) =>
    setPersonas(personas.map(p => p.id === id ? { ...p, ...patch } : p));
  const remove = (id: string) => setPersonas(personas.filter(p => p.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {personas.length === 0 && (
        <div style={{
          padding: '16px 18px', background: SOFT, border: `1px solid ${BORDER}`,
          fontFamily: FONT, fontSize: 13, color: MUTED, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 800, color: INK, marginBottom: 6 }}>Así de concreto te pedimos:</div>
          &ldquo;Laura, 32. Nutricionista. Vive sola en Gràcia. Duerme mal. Quiere cuidar su piel sin gastar mucho.
          Usa palabras como &lsquo;rutina&rsquo;, &lsquo;sérum&rsquo;, &lsquo;consistencia&rsquo;.
          No le hables de &lsquo;antiedad&rsquo; ni &lsquo;milagro&rsquo;.&rdquo;
        </div>
      )}

      {personas.map((p) => {
        const initial = p.persona_name ? p.persona_name[0].toUpperCase() : '—';
        return (
          <div key={p.id} style={{ background: '#ffffff', border: `1px solid ${BORDER}`, padding: 18 }}>
            {/* Header: avatar + nombre + eliminar */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, flexShrink: 0,
                background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_D} 100%)`,
                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT_C, fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em',
              }}>
                {initial}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  style={{
                    border: 'none', padding: 0, fontFamily: FONT, fontSize: '1.05rem',
                    fontWeight: 700, letterSpacing: '-0.01em', outline: 'none', background: 'transparent', color: INK,
                  }}
                  type="text"
                  placeholder="Nombre (ej: Laura, 32)"
                  value={p.persona_name}
                  onChange={(e) => update(p.id, { persona_name: e.target.value })}
                />
                <input
                  style={{
                    border: 'none', padding: 0, fontFamily: FONT, fontSize: 12,
                    color: MUTED, outline: 'none', background: 'transparent',
                  }}
                  type="text"
                  placeholder="Descripción breve (profesión, situación, estilo de vida)"
                  value={p.lifestyle ?? ''}
                  onChange={(e) => update(p.id, { lifestyle: e.target.value })}
                />
              </div>
              <button
                type="button" onClick={() => remove(p.id)}
                style={{ padding: 4, background: 'transparent', border: 'none', color: MUTED_2, cursor: 'pointer', display: 'inline-flex', alignSelf: 'start' }}
                aria-label="Eliminar"
              ><IconTrash /></button>
            </div>

            {/* Grid de chips de color */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Qué le duele</Label>
                <TagInput values={p.pains} onChange={(v) => update(p.id, { pains: v })} placeholder="Añadir, Enter" color={DANGER} />
              </div>
              <div>
                <Label>Qué desea</Label>
                <TagInput values={p.desires} onChange={(v) => update(p.id, { desires: v })} placeholder="Añadir, Enter" color={SUCCESS} />
              </div>
              <div>
                <Label>Palabras que usa</Label>
                <TagInput values={p.lingo_yes} onChange={(v) => update(p.id, { lingo_yes: v })} placeholder="Añadir, Enter" color={ACCENT} />
              </div>
              <div>
                <Label>Palabras a evitar</Label>
                <TagInput values={p.lingo_no} onChange={(v) => update(p.id, { lingo_no: v })} placeholder="Añadir, Enter" color={MUTED} />
              </div>
            </div>
          </div>
        );
      })}

      {personas.length < 3 && (
        <button
          type="button"
          onClick={add}
          style={{
            padding: '14px 16px', background: '#ffffff', border: `1px dashed ${BORDER_2}`,
            color: INK, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <IconPlus />
          {personas.length === 0 ? 'Crear primer perfil de cliente' : `Añadir otro perfil (${personas.length}/3)`}
        </button>
      )}
    </div>
  );
}

// ─── 4. Compliance — toggles grandes ─────────────────────────────────────────

function ComplianceEditor({
  sector, flags, setFlags,
}: { sector: SocialSector; flags: Record<string, unknown>; setFlags: (f: Record<string, unknown>) => void }) {
  const { sector_specific, generic } = getComplianceQuestions(sector);

  const setFlag = (key: string, val: unknown) => setFlags({ ...flags, [key]: val });

  const renderQ = (q: ComplianceQuestion) => {
    const isOn    = !!flags[q.key];
    const isDanger = q.danger && isOn;

    if (q.type === 'radio' && q.options) {
      return (
        <div key={q.key} style={{ marginBottom: 12 }}>
          <Label>{q.label}</Label>
          {q.help && <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED, marginBottom: 8 }}>{q.help}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {q.options.map((opt) => {
              const selected = flags[q.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFlag(q.key, opt.value)}
                  style={{
                    padding: '8px 14px',
                    border: `1px solid ${selected ? ACCENT : BORDER_2}`,
                    background: selected ? ACCENT : '#ffffff',
                    color: selected ? '#ffffff' : MUTED,
                    fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        key={q.key}
        style={{
          padding: '14px 16px', marginBottom: 8,
          background: isDanger ? DANGER_BG : (isOn ? '#f0fdfa' : SOFT),
          border: `1px solid ${isDanger ? DANGER : (isOn ? ACCENT : BORDER)}`,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setFlag(q.key, !flags[q.key])}
            role="switch"
            aria-checked={isOn}
            style={{
              width: 44, height: 24, flexShrink: 0,
              background: isOn ? (isDanger ? DANGER : ACCENT) : BORDER,
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s', borderRadius: 12,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: isOn ? 22 : 2,
              width: 20, height: 20, background: '#ffffff', borderRadius: 10,
              transition: 'left 0.2s',
            }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
              color: isDanger ? DANGER : INK, lineHeight: 1.3,
            }}>
              {q.label}
            </div>
            {q.help && (
              <div style={{ fontFamily: FONT, fontSize: 11, color: isDanger ? DANGER : MUTED, marginTop: 3 }}>
                {q.help}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sector_specific.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_C, fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            Específico de tu sector
          </div>
          {sector_specific.map(renderQ)}
          <div style={{ height: 16 }} />
        </>
      )}
      <div style={{ fontFamily: FONT_C, fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        General
      </div>
      {generic.map(renderQ)}
    </div>
  );
}

// ─── 5. Competidores — 3 columnas ────────────────────────────────────────────

function CompetitorsEditor({
  competitors, setCompetitors,
}: { competitors: BriefCompetitor[]; setCompetitors: (c: BriefCompetitor[]) => void }) {
  const add = (kind: 'direct' | 'reference' | 'anti') => {
    const base = { id: crypto.randomUUID(), name: '', ig_handle: '', comment: '', is_direct_competitor: false, is_reference: false, is_anti_reference: false };
    if (kind === 'direct')    setCompetitors([...competitors, { ...base, is_direct_competitor: true }]);
    if (kind === 'reference') setCompetitors([...competitors, { ...base, is_reference: true }]);
    if (kind === 'anti')      setCompetitors([...competitors, { ...base, is_anti_reference: true }]);
  };
  const update = (id: string, patch: Partial<BriefCompetitor>) =>
    setCompetitors(competitors.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id: string) => setCompetitors(competitors.filter(c => c.id !== id));

  const direct     = competitors.filter(c => c.is_direct_competitor);
  const references = competitors.filter(c => c.is_reference);
  const antiRefs   = competitors.filter(c => c.is_anti_reference);

  const renderBlock = (
    title: string, subtitle: string, color: string,
    items: BriefCompetitor[], kind: 'direct' | 'reference' | 'anti', max: number,
  ) => (
    <div style={{
      padding: 14, background: SOFT, border: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div>
        <div style={{ fontFamily: FONT_C, fontSize: 13, fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED, marginTop: 2 }}>{subtitle}</div>
      </div>
      {items.map((c) => (
        <div key={c.id} style={{
          background: '#ffffff', border: `1px solid ${BORDER}`, padding: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              style={{
                flex: 1, border: 'none', padding: 0, fontFamily: FONT, fontSize: 13,
                fontWeight: 700, outline: 'none', background: 'transparent', color: INK,
              }}
              type="text"
              placeholder="Nombre"
              value={c.name}
              onChange={(e) => update(c.id, { name: e.target.value })}
            />
            <button
              type="button" onClick={() => remove(c.id)}
              style={{ padding: 4, background: 'transparent', border: 'none', color: MUTED_2, cursor: 'pointer', display: 'inline-flex' }}
            ><IconTrash /></button>
          </div>
          <input
            style={{
              border: 'none', padding: 0, fontFamily: FONT, fontSize: 12,
              color: color, fontWeight: 600, outline: 'none', background: 'transparent',
            }}
            type="text"
            placeholder="@handle de Instagram"
            value={c.ig_handle ?? ''}
            onChange={(e) => update(c.id, { ig_handle: e.target.value })}
          />
          <input
            style={{
              border: 'none', padding: 0, fontFamily: FONT, fontSize: 12,
              color: MUTED, fontStyle: 'italic', outline: 'none', background: 'transparent',
            }}
            type="text"
            placeholder={kind === 'anti' ? 'Qué queremos evitar de ellos' : kind === 'reference' ? 'Qué admiras' : 'Qué hacen bien'}
            value={c.comment ?? ''}
            onChange={(e) => update(c.id, { comment: e.target.value })}
          />
        </div>
      ))}

      {items.length < max && (
        <button
          type="button"
          onClick={() => add(kind)}
          style={{
            padding: '10px', background: '#ffffff', border: `1px dashed ${BORDER_2}`,
            color: MUTED, fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <IconPlus /> Añadir
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {renderBlock('Competencia directa',    'Con quien compites por clientes', INK,    direct,     'direct',    3)}
      {renderBlock('Te inspiran',            'Cuentas que admiras',             ACCENT, references, 'reference', 3)}
      {renderBlock('No queremos parecernos', 'Cuentas a evitar',               DANGER, antiRefs,   'anti',      2)}
    </div>
  );
}
