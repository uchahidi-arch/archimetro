import type { Dir, Step } from '@/data/types';

export interface Pt {
  x: number;
  y: number;
}

const H = Math.SQRT1_2;

export const DIR_VEC: Record<Dir, Pt> = {
  N: { x: 0, y: -1 },
  NE: { x: H, y: -H },
  E: { x: 1, y: 0 },
  SE: { x: H, y: H },
  S: { x: 0, y: 1 },
  SW: { x: -H, y: H },
  W: { x: -1, y: 0 },
  NW: { x: -H, y: -H },
};

export const DIR_ARROW: Record<Dir, string> = {
  N: '↑',
  NE: '↗',
  E: '→',
  SE: '↘',
  S: '↓',
  SW: '↙',
  W: '←',
  NW: '↖',
};

export const OPPOSITE: Record<Dir, Dir> = {
  N: 'S',
  NE: 'SW',
  E: 'W',
  SE: 'NW',
  S: 'N',
  SW: 'NE',
  W: 'E',
  NW: 'SE',
};

export const CORNER_RADIUS = 46;

export interface Poly {
  /** Points échantillonnés du tracé, coins arrondis compris. */
  pts: Pt[];
  /** Distance cumulée le long du tracé, pour chaque point. */
  cum: number[];
  length: number;
  /** Distance du « sommet » de chaque coin (milieu de la courbe) ; index 0 = origine, dernier = bout. */
  vertDist: number[];
}

/** Construit le tracé d'une ligne à partir de son origine et de ses segments. */
export function buildPoly(origin: Pt, steps: Step[], radius = CORNER_RADIUS): Poly {
  const verts: Pt[] = [origin];
  for (const s of steps) {
    const v = DIR_VEC[s.dir];
    const l = verts[verts.length - 1];
    verts.push({ x: l.x + v.x * s.len, y: l.y + v.y * s.len });
  }

  const pts: Pt[] = [origin];
  const refIdx: number[] = [0];

  for (let i = 1; i < verts.length; i++) {
    const cur = verts[i];
    const last = i === verts.length - 1;
    if (!last && steps[i - 1].dir !== steps[i].dir) {
      const d = Math.min(radius, steps[i - 1].len / 2, steps[i].len / 2);
      const va = DIR_VEC[steps[i - 1].dir];
      const vb = DIR_VEC[steps[i].dir];
      const a = { x: cur.x - va.x * d, y: cur.y - va.y * d };
      const b = { x: cur.x + vb.x * d, y: cur.y + vb.y * d };
      pts.push(a);
      const N = 10;
      for (let t = 1; t <= N; t++) {
        const u = t / N;
        const m = 1 - u;
        pts.push({
          x: m * m * a.x + 2 * m * u * cur.x + u * u * b.x,
          y: m * m * a.y + 2 * m * u * cur.y + u * u * b.y,
        });
        if (t === N / 2) refIdx.push(pts.length - 1);
      }
    } else {
      pts.push(cur);
      refIdx.push(pts.length - 1);
    }
  }

  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }

  return { pts, cum, length: cum[cum.length - 1], vertDist: refIdx.map((i) => cum[i]) };
}

export function polyLength(steps: Step[]): number {
  return buildPoly({ x: 0, y: 0 }, steps).length;
}

/** Point du tracé à la distance `dist`, avec l'angle local (degrés, y vers le bas). */
export function pointAt(poly: Poly, dist: number): Pt & { angle: number } {
  const { pts, cum } = poly;
  if (pts.length < 2) return { x: pts[0].x, y: pts[0].y, angle: 90 };
  const d = Math.max(0, Math.min(poly.length, dist));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / seg;
  const a = pts[i - 1];
  const b = pts[i];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

export function pathD(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}
