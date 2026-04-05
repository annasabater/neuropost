'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function EstadoClient() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  async function subscribe() {
    if (!email.includes('@')) { toast.error('Email inválido'); return; }
    const res = await fetch('/api/status/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.ok) { setDone(true); toast.success('¡Suscrito!'); }
    else toast.error('Error al suscribirse');
  }

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '28px 32px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Recibe notificaciones de incidencias</div>
      <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 20 }}>Te avisamos por email si hay algún problema</div>
      {done ? (
        <div style={{ color: '#059669', fontWeight: 700 }}>✅ ¡Suscrito correctamente!</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" type="email"
            onKeyDown={(e) => e.key === 'Enter' && subscribe()}
            style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', width: 240 }} />
          <button onClick={subscribe} style={{ padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Suscribirme →
          </button>
        </div>
      )}
    </div>
  );
}
