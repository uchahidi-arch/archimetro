import type { Collection, Dir, Line, Link, Station } from '@/data/types';
import type { ConnectorId } from '@/data/connectors';
import { buildPoly, polyLength } from './geometry';

/** Opérations pures de l'éditeur : chacune renvoie une nouvelle collection. */

export const uid = (): string => crypto.randomUUID();

const newStation = (lineId: string, dist: number, title: string): Station => ({
  id: uid(),
  lineId,
  dist,
  qualifier: 'processus',
  title,
  description: '',
  imagePath: null,
  source: null,
  url: null,
  tasks: [],
});

export function addFirstLine(
  c: Collection,
  v: { name: string; color: string; title: string },
): { collection: Collection; stationId: string } {
  const line: Line = {
    id: uid(),
    name: v.name || 'Ligne 1',
    color: v.color,
    parentStationId: null,
    origin: { x: 0, y: 0 },
    steps: [],
    position: c.lines.length,
  };
  const station = newStation(line.id, 0, v.title);
  return {
    collection: { ...c, lines: [...c.lines, line], stations: [...c.stations, station] },
    stationId: station.id,
  };
}

export function addBranch(
  c: Collection,
  parentStationId: string,
  v: { name: string; color: string; dir: Dir; len: number; title: string },
): { collection: Collection; stationId: string } {
  const steps = [{ dir: v.dir, len: v.len }];
  const line: Line = {
    id: uid(),
    name: v.name || `Ligne ${c.lines.length + 1}`,
    color: v.color,
    parentStationId,
    origin: { x: 0, y: 0 },
    steps,
    position: c.lines.length,
  };
  const station = newStation(line.id, polyLength(steps), v.title);
  return {
    collection: { ...c, lines: [...c.lines, line], stations: [...c.stations, station] },
    stationId: station.id,
  };
}

/** Prolonge une ligne d'un segment et pose une station au bout. */
export function extendLine(
  c: Collection,
  lineId: string,
  v: { dir: Dir; len: number; title: string },
): { collection: Collection; stationId: string } {
  const line = c.lines.find((l) => l.id === lineId);
  if (!line) return { collection: c, stationId: '' };

  const oldLen = polyLength(line.steps);
  const steps = [...line.steps, { dir: v.dir, len: v.len }];
  const poly = buildPoly({ x: 0, y: 0 }, steps);
  // L'ancien bout devient un coin arrondi : les stations qui s'y trouvaient restent au sommet du coin.
  const cornerDist = poly.vertDist[line.steps.length];

  const stations = c.stations.map((s) =>
    s.lineId === lineId && s.dist >= oldLen - 1 ? { ...s, dist: cornerDist } : s,
  );
  const station = newStation(lineId, poly.length, v.title);

  return {
    collection: {
      ...c,
      lines: c.lines.map((l) => (l.id === lineId ? { ...l, steps } : l)),
      stations: [...stations, station],
    },
    stationId: station.id,
  };
}

export function insertStation(
  c: Collection,
  lineId: string,
  dist: number,
): { collection: Collection; stationId: string } {
  const station = newStation(lineId, dist, '');
  return { collection: { ...c, stations: [...c.stations, station] }, stationId: station.id };
}

export function updateStation(c: Collection, id: string, patch: Partial<Station>): Collection {
  return { ...c, stations: c.stations.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function updateLine(c: Collection, id: string, patch: Partial<Line>): Collection {
  return { ...c, lines: c.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

/** Supprime des lignes avec leurs stations, leurs branches (récursivement) et les liens concernés. */
function removeLines(c: Collection, seedLineIds: string[], extraStationIds: string[] = []): Collection {
  const lineIds = new Set(seedLineIds);
  const stationIds = new Set(extraStationIds);

  let grew = true;
  while (grew) {
    grew = false;
    for (const s of c.stations) {
      if (lineIds.has(s.lineId) && !stationIds.has(s.id)) {
        stationIds.add(s.id);
        grew = true;
      }
    }
    for (const l of c.lines) {
      if (!lineIds.has(l.id) && l.parentStationId && stationIds.has(l.parentStationId)) {
        lineIds.add(l.id);
        grew = true;
      }
    }
  }

  return {
    ...c,
    lines: c.lines.filter((l) => !lineIds.has(l.id)),
    stations: c.stations.filter((s) => !stationIds.has(s.id)),
    links: c.links.filter((k) => !stationIds.has(k.fromId) && !stationIds.has(k.toId)),
  };
}

export function deleteLine(c: Collection, lineId: string): Collection {
  return removeLines(c, [lineId]);
}

export function deleteStation(c: Collection, stationId: string): Collection {
  // Les branches qui partent de cette station disparaissent avec elle.
  const branches = c.lines.filter((l) => l.parentStationId === stationId).map((l) => l.id);
  return removeLines(c, branches, [stationId]);
}

export function addLink(
  c: Collection,
  v: { fromId: string; toId: string; connector: ConnectorId; label: string },
): Collection {
  const link: Link = {
    id: uid(),
    fromId: v.fromId,
    toId: v.toId,
    connector: v.connector,
    label: v.label || undefined,
  };
  return { ...c, links: [...c.links, link] };
}

export function deleteLink(c: Collection, id: string): Collection {
  return { ...c, links: c.links.filter((l) => l.id !== id) };
}
