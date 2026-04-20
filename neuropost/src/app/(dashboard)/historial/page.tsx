import { redirect } from 'next/navigation';

export default function HistorialRedirect() {
  redirect('/feed?tab=historial');
}
