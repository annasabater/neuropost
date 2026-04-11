import { redirect } from 'next/navigation';

export default function IdeasPage() {
  redirect('/inspiracion?tab=ideas');
}
