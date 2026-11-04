import type { Metadata } from 'next';
import NewMapForm from '@/components/home/NewMapForm';

export const metadata: Metadata = { title: 'Nouvelle carte · ArchiMétro' };

export default function Page() {
  return <NewMapForm />;
}
