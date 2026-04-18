import FinanzasPanel from './FinanzasPanel';
import { getFinanzasData } from './data';

export const metadata = {
  title: 'Panel financiero · Neuropost',
  description: 'Métricas financieras y de salud del negocio',
};

export default async function FinanzasPage() {
  const data = getFinanzasData();
  return <FinanzasPanel data={data} />;
}
