'use client';

import React, { useState } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Shared styles — same inline pattern as v1 forms (vigente en el proyecto).
// ────────────────────────────────────────────────────────────────────────────

export const f  = "var(--font-barlow), 'Barlow', sans-serif";
export const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  fontFamily: f,
  fontSize: 13,
  outline: 'none',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

// Select con chevron custom — quita la flecha nativa fea y mantiene coherencia
// brutalist con el resto de inputs.
const chevronSvg =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%23374151' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")";

export const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 36px 8px 12px',
  border: '1px solid var(--border)',
  fontFamily: f,
  fontSize: 13,
  outline: 'none',
  background: `var(--bg) ${chevronSvg} no-repeat right 12px center`,
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  lineHeight: 1.4,
};

export const labelStyle: React.CSSProperties = {
  fontFamily: f,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 4,
};

export const sectionTitleStyle: React.CSSProperties = {
  fontFamily: fc,
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-primary)',
  marginBottom: 8,
};

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

export const removeBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  fontFamily: f,
  fontSize: 12,
  color: '#ef4444',
  cursor: 'pointer',
  flexShrink: 0,
};

export const addBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px dashed var(--border)',
  background: 'transparent',
  fontFamily: fc,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

// ────────────────────────────────────────────────────────────────────────────
// datetime helpers
// HTML `datetime-local` value format: YYYY-MM-DDTHH:MM (no TZ suffix).
// We convert to/from ISO at the boundary. Empty string → undefined.
// ────────────────────────────────────────────────────────────────────────────

export function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// Collapsible section
// ────────────────────────────────────────────────────────────────────────────

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title:        string;
  defaultOpen?: boolean;
  children:     React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: fc,
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{title}</span>
        <span style={{ fontFamily: f, fontSize: 14 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '8px 14px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chips input — plain array of strings. Add on Enter or comma.
// ────────────────────────────────────────────────────────────────────────────

export function ChipsInput({
  value,
  onChange,
  placeholder,
}: {
  value:       string[];
  onChange:    (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (value.includes(t)) { setDraft(''); return; }
    onChange([...value, t]);
    setDraft('');
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {value.map((tag) => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', background: 'var(--bg-1)', border: '1px solid var(--border)',
            fontFamily: f, fontSize: 12, color: 'var(--text-primary)',
          }}>
            {tag}
            <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={placeholder ?? 'Añadir y pulsar Enter'}
        style={inputStyle}
      />
    </div>
  );
}
