'use client';

import { useEffect } from 'react';
import type { ScheduleContentV2T } from '@/types';
import {
  f, inputStyle, labelStyle, sectionTitleStyle, rowStyle,
  addBtnStyle, removeBtnStyle,
  Collapsible, isoToLocalInput, localInputToIso,
} from './_v2/shared';

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_VALUES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayVal = typeof DAY_VALUES[number];

function emptyContent(): ScheduleContentV2T {
  return {
    schema_version: 2,
    schedules: [{ label: 'Horario regular', days: [] }],
  };
}

export function ScheduleFormV2({
  value,
  onChange,
}: {
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const v = (value as Partial<ScheduleContentV2T> | undefined) ?? {};

  // Bootstrap: si no viene schema_version: 2 o schedules falta/vacío, emitimos
  // un esqueleto mínimo válido. Garantiza que el primer onChange del parent
  // produce algo que pasa CONTENT_SCHEMAS.schedule.v2.safeParse.
  useEffect(() => {
    if (v.schema_version !== 2 || !Array.isArray(v.schedules) || v.schedules.length === 0) {
      onChange(emptyContent());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data: ScheduleContentV2T = (v.schema_version === 2 && Array.isArray(v.schedules) && v.schedules.length > 0)
    ? (v as ScheduleContentV2T)
    : emptyContent();

  function emit(next: ScheduleContentV2T) {
    onChange({ ...next, schema_version: 2 });
  }

  function updateSchedule(idx: number, patch: Partial<ScheduleContentV2T['schedules'][number]>) {
    emit({ ...data, schedules: data.schedules.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  }

  function addSchedule() {
    emit({ ...data, schedules: [...data.schedules, { label: 'Horario estacional', days: [] }] });
  }

  function removeSchedule(idx: number) {
    if (idx === 0 || data.schedules.length <= 1) return;
    emit({ ...data, schedules: data.schedules.filter((_, i) => i !== idx) });
  }

  function setDayHours(idx: number, day: DayVal, hours: string) {
    const s = data.schedules[idx]!;
    const existing = s.days.find(d => d.day === day);
    const nextDays = existing
      ? s.days.map(d => d.day === day ? { ...d, hours } : d)
      : [...s.days, { day, hours }];
    updateSchedule(idx, { days: nextDays });
  }

  function toggleDay(idx: number, day: DayVal, checked: boolean) {
    const s = data.schedules[idx]!;
    if (checked && !s.days.find(d => d.day === day)) {
      updateSchedule(idx, { days: [...s.days, { day, hours: '9:00-20:00' }] });
    } else if (!checked) {
      updateSchedule(idx, { days: s.days.filter(d => d.day !== day) });
    }
  }

  function setDayNote(idx: number, day: DayVal, note: string) {
    const s = data.schedules[idx]!;
    const nextDays = s.days.map(d => d.day === day ? (note ? { ...d, note } : { day: d.day, hours: d.hours }) : d);
    updateSchedule(idx, { days: nextDays });
  }

  // Exceptions
  const exceptions = data.exceptions ?? [];
  function setExceptions(next: typeof exceptions) {
    emit({ ...data, exceptions: next.length ? next : undefined });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.schedules.map((s, idx) => (
        <div key={idx} style={{ border: '1px solid var(--border)', background: 'var(--bg)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nombre del horario *</label>
              <input
                value={s.label}
                onChange={e => updateSchedule(idx, { label: e.target.value })}
                placeholder="Ej: Horario regular, Verano 2026..."
                style={inputStyle}
              />
            </div>
            {idx > 0 && (
              <button type="button" onClick={() => removeSchedule(idx)} style={{ ...removeBtnStyle, alignSelf: 'flex-end' }}>Eliminar</button>
            )}
          </div>

          <div>
            <div style={sectionTitleStyle}>Días</div>

            {/* Fila compacta: 7 pastillas con la inicial del día, toggle on/off */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
              {DAYS_ES.map((dayLabel, i) => {
                const dayVal  = DAY_VALUES[i]!;
                const active  = !!s.days.find(d => d.day === dayVal);
                const initial = dayLabel === 'Miércoles' ? 'X' : dayLabel.charAt(0);
                return (
                  <button
                    key={dayVal}
                    type="button"
                    onClick={() => toggleDay(idx, dayVal, !active)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Quitar' : 'Añadir'} ${dayLabel}`}
                    title={dayLabel}
                    style={{
                      padding: '10px 0',
                      background:  active ? 'var(--accent)' : 'var(--bg)',
                      color:       active ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      fontFamily:  f,
                      fontSize:    13,
                      fontWeight:  active ? 700 : 500,
                      cursor:      'pointer',
                      transition:  'background 0.12s, color 0.12s, border-color 0.12s',
                    }}
                  >
                    {initial}
                  </button>
                );
              })}
            </div>

            {/* Filas de horario sólo para días activos */}
            {s.days.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DAYS_ES.map((dayLabel, i) => {
                  const dayVal = DAY_VALUES[i]!;
                  const entry  = s.days.find(d => d.day === dayVal);
                  if (!entry) return null;
                  return (
                    <div key={dayVal} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 90 }}>
                        {dayLabel}
                      </span>
                      <input
                        value={entry.hours}
                        onChange={e => setDayHours(idx, dayVal, e.target.value)}
                        placeholder="9:00-20:00"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <input
                        value={entry.note ?? ''}
                        onChange={e => setDayNote(idx, dayVal, e.target.value)}
                        placeholder="Nota (opcional)"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Collapsible title="Ventana de vigencia (opcional)">
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Activo desde</label>
                <input
                  type="datetime-local"
                  value={isoToLocalInput(s.active_from)}
                  onChange={e => updateSchedule(idx, { active_from: localInputToIso(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Activo hasta</label>
                <input
                  type="datetime-local"
                  value={isoToLocalInput(s.active_to)}
                  onChange={e => updateSchedule(idx, { active_to: localInputToIso(e.target.value) })}
                  style={inputStyle}
                />
              </div>
            </div>
          </Collapsible>
        </div>
      ))}

      <button type="button" onClick={addSchedule} style={addBtnStyle}>+ Añadir horario</button>

      <Collapsible title="Días excepcionales (festivos, cierres)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exceptions.map((ex, i) => (
            <div key={i} style={rowStyle}>
              <input
                type="date"
                value={ex.date}
                onChange={e => setExceptions(exceptions.map((x, k) => k === i ? { ...x, date: e.target.value } : x))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                value={ex.reason}
                onChange={e => setExceptions(exceptions.map((x, k) => k === i ? { ...x, reason: e.target.value } : x))}
                placeholder="Motivo (ej: Navidad)"
                style={{ ...inputStyle, flex: 2 }}
              />
              <input
                value={ex.hours ?? ''}
                onChange={e => setExceptions(exceptions.map((x, k) => k === i ? { ...x, hours: e.target.value || undefined } : x))}
                placeholder="Horario (opcional)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={() => setExceptions(exceptions.filter((_, k) => k !== i))} style={removeBtnStyle}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setExceptions([...exceptions, { date: '', reason: '' }])} style={addBtnStyle}>+ Añadir excepción</button>
        </div>
      </Collapsible>
    </div>
  );
}
