import MapsHome from '@/components/home/MapsHome';
import { getCollections } from '@/lib/getCollection';

export const dynamic = 'force-dynamic';

/** Accueil : léger, il n'embarque pas la scène 3D (elle ne se charge que sur les pages d'une carte). */
export default async function Page() {
  const maps = await getCollections();
  return <MapsHome initial={maps} />;
}
