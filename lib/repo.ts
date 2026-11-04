import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY } from '@/data/empty';
import type { Collection, Line, Link, Station, Task } from '@/data/types';
import { fetchCollections } from './db';

/**
 * Persistance côté navigateur. Deux implémentations :
 * - Supabase (si NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies) ;
 * - localStorage sinon, pour développer et tester sans base.
 * L'éditeur ne sait rien de tout ça : il appelle sync(avant, après) et le dépôt calcule la différence.
 */
export interface Repo {
  kind: 'supabase' | 'local';
  /** Toutes les cartes. */
  list(): Promise<Collection[]>;
  /** Crée une carte vierge et renvoie son identifiant. */
  create(title: string, subtitle: string): Promise<string>;
  remove(id: string): Promise<void>;
  sync(prev: Collection, next: Collection): Promise<void>;
  /** Envoie une image et renvoie le chemin à stocker dans station.imagePath. */
  uploadImage(file: File): Promise<string>;
  /** Mode local uniquement : relit une carte depuis le navigateur. */
  loadLocal?(id: string): Collection | null;
}

const LS_PREFIX = 'archimetro:map:';
const BUCKET = 'cards';

/** Identifiant lisible et unique : « Ma carte » → « ma-carte-k3x9 ». */
export function newMapId(title: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'carte';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function resolveImage(base: string, path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  return `${base}/${path}`;
}

async function resize(file: File, max = 1000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.85),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture impossible'));
    r.readAsDataURL(blob);
  });
}

function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const upserts = next.filter((x) => {
    const p = before.get(x.id);
    return !p || JSON.stringify(p) !== JSON.stringify(x);
  });
  const nextIds = new Set(next.map((x) => x.id));
  const removed = prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
  return { upserts, removed, before };
}

// --- Local ---------------------------------------------------------------

const localRepo: Repo = {
  kind: 'local',

  async list() {
    const maps: Collection[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      try {
        maps.push(JSON.parse(localStorage.getItem(key) ?? '') as Collection);
      } catch {
        /* entrée illisible : ignorée */
      }
    }
    return maps.sort((a, b) => a.title.localeCompare(b.title));
  },

  async create(title, subtitle) {
    const id = newMapId(title);
    const map: Collection = { ...EMPTY, id, title: title || 'Nouvelle carte', subtitle };
    localStorage.setItem(LS_PREFIX + id, JSON.stringify(map));
    return id;
  },

  async remove(id) {
    localStorage.removeItem(LS_PREFIX + id);
  },

  async sync(_prev, next) {
    localStorage.setItem(LS_PREFIX + next.id, JSON.stringify(next));
  },

  async uploadImage(file) {
    return blobToDataUrl(await resize(file, 800));
  },

  loadLocal(id) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + id);
      return raw ? (JSON.parse(raw) as Collection) : null;
    } catch {
      return null;
    }
  },
};

// --- Supabase ------------------------------------------------------------

const lineRow = (c: Collection, l: Line) => ({
  id: l.id,
  collection_id: c.id,
  name: l.name,
  color: l.color,
  parent_station_id: l.parentStationId,
  origin_x: l.origin.x,
  origin_y: l.origin.y,
  steps: l.steps,
  position: l.position,
});

const stationRow = (s: Station) => ({
  id: s.id,
  line_id: s.lineId,
  dist: s.dist,
  qualifier: s.qualifier,
  title: s.title,
  description: s.description ?? null,
  image_path: s.imagePath ?? null,
  source: s.source ?? null,
  url: s.url ?? null,
});

const taskRow = (stationId: string, t: Task) => ({
  id: t.id,
  station_id: stationId,
  label: t.label,
  description: t.description ?? null,
  position: t.position,
});

const linkRow = (c: Collection, k: Link) => ({
  id: k.id,
  collection_id: c.id,
  from_station_id: k.fromId,
  to_station_id: k.toId,
  connector: k.connector,
  label: k.label ?? null,
});

function supabaseRepo(url: string, key: string): Repo {
  // Le client Supabase n'est chargé qu'au premier appel : les pages qui ne font que lire (accueil,
  // lecture d'une carte) n'ont pas à le télécharger.
  let client: SupabaseClient | null = null;
  const getDb = async (): Promise<SupabaseClient> => {
    if (!client) {
      const { createClient } = await import('@supabase/supabase-js');
      client = createClient(url, key, { auth: { persistSession: false } });
    }
    return client;
  };

  const check = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  };

  return {
    kind: 'supabase',

    async list() {
      return fetchCollections(await getDb());
    },

    async create(title, subtitle) {
      const db = await getDb();
      const id = newMapId(title);
      check(
        await db.from('collections').insert({
          id,
          title: title || 'Nouvelle carte',
          subtitle,
          viewpoint: EMPTY.viewpoint,
        }),
      );
      return id;
    },

    async remove(id) {
      const db = await getDb();
      // Les lignes, stations, opérations et relations partent en cascade.
      check(await db.from('collections').delete().eq('id', id));
    },

    async sync(prev, next) {
      const db = await getDb();
      check(
        await db.from('collections').upsert({
          id: next.id,
          title: next.title,
          subtitle: next.subtitle,
          viewpoint: next.viewpoint,
        }),
      );

      const lines = diffById(prev.lines, next.lines);
      const stations = diffById(prev.stations, next.stations);
      const links = diffById(prev.links, next.links);

      // Suppressions d'abord (les tâches partent en cascade avec les stations).
      if (links.removed.length) check(await db.from('links').delete().in('id', links.removed));
      if (stations.removed.length) check(await db.from('stations').delete().in('id', stations.removed));
      if (lines.removed.length) check(await db.from('lines').delete().in('id', lines.removed));

      // Puis les ajouts et modifications, dans l'ordre des dépendances.
      if (lines.upserts.length) check(await db.from('lines').upsert(lines.upserts.map((l) => lineRow(next, l))));
      if (stations.upserts.length) check(await db.from('stations').upsert(stations.upserts.map(stationRow)));

      const taskChanged = stations.upserts.filter((s) => {
        const p = stations.before.get(s.id);
        return !p || JSON.stringify(p.tasks) !== JSON.stringify(s.tasks);
      });
      if (taskChanged.length) {
        check(await db.from('tasks').delete().in('station_id', taskChanged.map((s) => s.id)));
        const rows = taskChanged.flatMap((s) => s.tasks.map((t) => taskRow(s.id, t)));
        if (rows.length) check(await db.from('tasks').insert(rows));
      }

      if (links.upserts.length) check(await db.from('links').upsert(links.upserts.map((k) => linkRow(next, k))));
    },

    async uploadImage(file) {
      const db = await getDb();
      const blob = await resize(file, 1200);
      const name = `${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage.from(BUCKET).upload(name, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      return name;
    },
  };
}

export function createRepo(): Repo {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return supabaseRepo(url, key);
  return localRepo;
}
