import type { Collection, Line, Station } from '@/data/types';
import { buildPoly, pointAt, type Poly, type Pt } from './geometry';

export interface StationPos {
  x: number;
  y: number;
  angle: number;
  /** Vrai si la ligne est plutôt verticale à cet endroit (les étiquettes passent alors à droite). */
  vertical: boolean;
}

export interface Layout {
  polys: Record<string, Poly>;
  stations: Record<string, StationPos>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Calcule le tracé de chaque ligne et la position de chaque station.
 * Une branche démarre à la position de sa station parente, donc on résout les parents d'abord.
 */
export function computeLayout(collection: Collection): Layout {
  const lineById = new Map<string, Line>(collection.lines.map((l) => [l.id, l]));
  const stationById = new Map<string, Station>(collection.stations.map((s) => [s.id, s]));
  const byLine = new Map<string, Station[]>();
  for (const s of collection.stations) {
    const list = byLine.get(s.lineId) ?? [];
    list.push(s);
    byLine.set(s.lineId, list);
  }

  const polys: Record<string, Poly> = {};
  const stations: Record<string, StationPos> = {};
  const resolving = new Set<string>();

  const resolve = (line: Line): void => {
    if (polys[line.id] || resolving.has(line.id)) return;
    resolving.add(line.id);

    let origin: Pt = line.origin;
    if (line.parentStationId) {
      const parent = stationById.get(line.parentStationId);
      const parentLine = parent ? lineById.get(parent.lineId) : undefined;
      if (parent && parentLine) {
        resolve(parentLine);
        const pp = stations[parent.id];
        if (pp) origin = { x: pp.x, y: pp.y };
      }
    }

    const poly = buildPoly(origin, line.steps);
    polys[line.id] = poly;
    for (const s of byLine.get(line.id) ?? []) {
      const p = pointAt(poly, s.dist);
      stations[s.id] = { x: p.x, y: p.y, angle: p.angle, vertical: Math.abs(Math.sin((p.angle * Math.PI) / 180)) > 0.7 };
    }
    resolving.delete(line.id);
  };

  collection.lines.forEach(resolve);

  const xs: number[] = [];
  const ys: number[] = [];
  for (const poly of Object.values(polys)) {
    for (const p of poly.pts) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const bounds = xs.length
    ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    : { minX: -200, maxX: 200, minY: -200, maxY: 200 };

  return { polys, stations, bounds };
}

/** Courbe entre deux stations ; renvoie le tracé et son milieu (pour poser la pastille). */
export function linkGeometry(a: Pt, b: Pt, trim = 20): { d: string; mid: Pt } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(0.28 * dist, 90);
  const c = { x: (a.x + b.x) / 2 + (-dy / dist) * bend, y: (a.y + b.y) / 2 + (dx / dist) * bend };

  const toward = (from: Pt, to: Pt): Pt => {
    const vx = to.x - from.x;
    const vy = to.y - from.y;
    const d = Math.hypot(vx, vy) || 1;
    return { x: from.x + (vx / d) * trim, y: from.y + (vy / d) * trim };
  };
  const s = toward(a, c);
  const e = toward(b, c);
  return {
    d: `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`,
    mid: { x: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y },
  };
}

/** Coupe un titre en deux lignes au plus. */
export function wrapLabel(text: string, max = 18): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let first = '';
  let i = 0;
  while (i < words.length && (first + ' ' + words[i]).trim().length <= max) {
    first = (first + ' ' + words[i]).trim();
    i += 1;
  }
  if (!first) return [text.slice(0, max - 1) + '…'];
  const rest = words.slice(i).join(' ');
  return rest.length > max + 2 ? [first, rest.slice(0, max) + '…'] : [first, rest];
}
