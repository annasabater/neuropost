'use client';
import { useEffect, useState } from 'react';

export default function IncidentBanner() {
  const [hasIncident, setHasIncident] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d) => {
      if (d.activeIncidents && d.activeIncidents.length > 0) {
        setHasIncident(true);
        setIncidentTitle(d.activeIncidents[0].title);
      }
    }).catch(() => null);
  }, []);

  if (!hasIncident) return null;

  return (
    <div style={{
      background: '#fefce8',
      border: '1px solid #fde047',
      borderRadius: 10,
      padding: '10px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: 13,
    }}>
      <span>⚠️ <strong>Incidencia en curso</strong> — {incidentTitle}</span>
      <a href="/estado" target="_blank" style={{ color: '#92400e', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
        Ver detalles →
      </a>
    </div>
  );
}
