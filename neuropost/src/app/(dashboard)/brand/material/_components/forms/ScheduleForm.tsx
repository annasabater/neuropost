'use client';

const f = "var(--font-barlow), 'Barlow', sans-serif";

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_VALUES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type DayHour = { day: string; hours: string };

export function ScheduleForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const days = (value.days as DayHour[]) ?? [];

  function setDay(dayVal: string, hours: string) {
    const existing = days.find(d => d.day === dayVal);
    if (existing) {
      onChange({ days: days.map(d => d.day === dayVal ? { ...d, hours } : d) });
    } else {
      onChange({ days: [...days, { day: dayVal, hours }] });
    }
  }

  function toggleDay(dayVal: string, checked: boolean) {
    if (checked) {
      if (!days.find(d => d.day === dayVal)) {
        onChange({ days: [...days, { day: dayVal, hours: '9:00-20:00' }] });
      }
    } else {
      onChange({ days: days.filter(d => d.day !== dayVal) });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS_ES.map((label, i) => {
        const dayVal = DAY_VALUES[i]!;
        const entry  = days.find(d => d.day === dayVal);
        return (
          <div key={dayVal} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 110 }}>
              <input
                type="checkbox"
                checked={!!entry}
                onChange={e => toggleDay(dayVal, e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
              />
              <span style={{ fontFamily: f, fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
            </label>
            {entry && (
              <input
                value={entry.hours}
                onChange={e => setDay(dayVal, e.target.value)}
                placeholder="9:00-20:00"
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--text-primary)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
