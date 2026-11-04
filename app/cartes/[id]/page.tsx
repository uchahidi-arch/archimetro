import { notFound } from 'next/navigation';
import MetroMap from '@/components/MetroMap';
import { getCollection, getImageBase } from '@/lib/getCollection';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ station?: string }>;
}

/** Lecture d'une carte : le plan 3D, sans les outils d'édition. */
export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { station } = await searchParams;
  const collection = await getCollection(id);
  if (!collection) notFound();

  return <MetroMap initial={collection} imageBase={getImageBase()} initialStationId={station} editing={false} />;
}
