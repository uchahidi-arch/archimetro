import { createClient } from '@supabase/supabase-js';
import { EMPTY } from '@/data/empty';
import type { Collection } from '@/data/types';
import { fetchCollections } from './db';

/** Lecture côté serveur (pages Next). Sans Supabase, le mode local prend le relais dans le navigateur. */

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export function getImageBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url}/storage/v1/object/public/cards` : '/cards';
}

/** Toutes les cartes (page d'accueil). Vide sans Supabase : la liste est alors lue dans le navigateur. */
export async function getCollections(): Promise<Collection[]> {
  const db = serverClient();
  return db ? fetchCollections(db) : [];
}

/**
 * Une carte. Avec Supabase : `null` si elle n'existe pas (la page renvoie alors un 404).
 * Sans Supabase : une carte vierge portant cet identifiant, que le navigateur remplace par la version locale.
 */
export async function getCollection(id: string): Promise<Collection | null> {
  const db = serverClient();
  if (!db) return { ...EMPTY, id };
  const [found] = await fetchCollections(db, [id]);
  return found ?? null;
}
