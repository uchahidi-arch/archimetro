import type { SupabaseClient } from '@supabase/supabase-js';
import { isConnectorId } from '@/data/connectors';
import { isQualifierId } from '@/data/qualifiers';
import type { Collection, Dir, Line, Link, Station, Step, Task } from '@/data/types';

/**
 * Lecture des cartes dans Supabase. Utilisé côté serveur (pages) comme côté navigateur (dépôt) :
 * ce module ne dépend ni de Next ni de React.
 */

interface Row {
  [key: string]: unknown;
}

const DIRS: Dir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

function parseSteps(v: unknown): Step[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (s): s is { dir: Dir; len: number } =>
        !!s && DIRS.includes((s as Row).dir as Dir) && typeof (s as Row).len === 'number',
    )
    .map((s) => ({ dir: s.dir, len: s.len }));
}

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

/**
 * Charge des cartes complètes (lignes, stations, opérations, relations) en 5 requêtes au total,
 * quel que soit leur nombre. Sans `ids`, charge toutes les cartes, de la plus ancienne à la plus récente.
 */
export async function fetchCollections(db: SupabaseClient, ids?: string[]): Promise<Collection[]> {
  const colQuery = db.from('collections').select('*').order('created_at', { ascending: true });
  const colRows = check<Row[]>(await (ids ? colQuery.in('id', ids) : colQuery));
  if (colRows.length === 0) return [];
  const colIds = colRows.map((c) => str(c.id));

  const lineRows = check<Row[]>(await db.from('lines').select('*').in('collection_id', colIds));
  const lineIds = lineRows.map((l) => str(l.id));

  const stationRows = lineIds.length
    ? check<Row[]>(await db.from('stations').select('*').in('line_id', lineIds))
    : [];
  const stationIds = stationRows.map((s) => str(s.id));

  const taskRows = stationIds.length
    ? check<Row[]>(await db.from('tasks').select('*').in('station_id', stationIds))
    : [];
  const linkRows = check<Row[]>(await db.from('links').select('*').in('collection_id', colIds));

  const tasksByStation = new Map<string, Task[]>();
  for (const t of taskRows) {
    const sid = str(t.station_id);
    const list = tasksByStation.get(sid) ?? [];
    list.push({
      id: str(t.id),
      label: str(t.label),
      description: str(t.description) || undefined,
      position: num(t.position),
    });
    tasksByStation.set(sid, list);
  }

  const lineColl = new Map<string, string>();
  const linesByColl = new Map<string, Line[]>();
  for (const l of lineRows) {
    const line: Line = {
      id: str(l.id),
      name: str(l.name),
      color: str(l.color) || '#a51d34',
      parentStationId: l.parent_station_id ? str(l.parent_station_id) : null,
      origin: { x: num(l.origin_x), y: num(l.origin_y) },
      steps: parseSteps(l.steps),
      position: num(l.position),
    };
    const cid = str(l.collection_id);
    lineColl.set(line.id, cid);
    linesByColl.set(cid, [...(linesByColl.get(cid) ?? []), line]);
  }

  const stationsByColl = new Map<string, Station[]>();
  for (const s of stationRows) {
    const q = str(s.qualifier);
    const station: Station = {
      id: str(s.id),
      lineId: str(s.line_id),
      dist: num(s.dist),
      qualifier: isQualifierId(q) ? q : 'processus',
      title: str(s.title),
      description: str(s.description) || undefined,
      imagePath: str(s.image_path) || null,
      source: str(s.source) || null,
      url: str(s.url) || null,
      tasks: (tasksByStation.get(str(s.id)) ?? []).sort((a, b) => a.position - b.position),
    };
    const cid = lineColl.get(station.lineId);
    if (cid) stationsByColl.set(cid, [...(stationsByColl.get(cid) ?? []), station]);
  }

  const linksByColl = new Map<string, Link[]>();
  for (const l of linkRows) {
    const c = str(l.connector);
    if (!isConnectorId(c)) continue;
    const cid = str(l.collection_id);
    linksByColl.set(cid, [
      ...(linksByColl.get(cid) ?? []),
      {
        id: str(l.id),
        fromId: str(l.from_station_id),
        toId: str(l.to_station_id),
        connector: c,
        label: str(l.label) || undefined,
      },
    ]);
  }

  return colRows.map((c) => {
    const id = str(c.id);
    return {
      id,
      title: str(c.title),
      subtitle: str(c.subtitle),
      viewpoint: str(c.viewpoint) || 'organisation',
      lines: linesByColl.get(id) ?? [],
      stations: stationsByColl.get(id) ?? [],
      links: linksByColl.get(id) ?? [],
    };
  });
}
