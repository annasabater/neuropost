'use client';

import { useId } from 'react';

interface ToggleProps {
  checked:      boolean;
  onChange:     (next: boolean) => void;
  label:        string;
  description?: string;
  disabled?:    boolean;
}

const C = {
  on:       '#0F766E',
  off:      '#e5e7eb',
  thumb:    '#ffffff',
  text:     '#111111',
  muted:    '#6b7280',
  border:   '#e5e7eb',
};

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  const descId = useId();

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            16,
        padding:        '12px 0',
        borderBottom:   `1px solid ${C.border}`,
        opacity:        disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: f }}>
          {label}
        </div>
        {description && (
          <div
            id={descId}
            style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, marginTop: 2, fontFamily: f }}
          >
            {description}
          </div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => { if (!disabled) onChange(!checked); }}
        style={{
          position:   'relative',
          width:      44,
          height:     24,
          flexShrink: 0,
          background: checked ? C.on : C.off,
          border:     'none',
          borderRadius: 0,
          padding:    2,
          cursor:     disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          fontFamily: fc,
          marginTop:  2,
        }}
      >
        <span
          style={{
            display:      'block',
            width:        20,
            height:       20,
            background:   C.thumb,
            borderRadius: 0,
            transform:    `translateX(${checked ? 20 : 0}px)`,
            transition:   'transform 0.15s',
          }}
        />
      </button>
    </div>
  );
}
