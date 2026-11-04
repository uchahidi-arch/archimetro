import type { Collection } from '@/data/types';
import { pathD } from '@/lib/geometry';
import { computeLayout } from '@/lib/layout';

/** Vignette d'une carte : le tracé des lignes en miniature. Pur SVG, aucune scène 3D. */
export default function MapThumb({ collection }: { collection: Collection }) {
  if (collection.lines.length === 0) {
    return <div className="thumb thumb-empty">Carte vide</div>;
  }

  const layout = computeLayout(collection);
  const { minX, minY, maxX, maxY } = layout.bounds;
  const w = Math.max(maxX - minX, 160);
  const h = Math.max(maxY - minY, 160);
  const pad = Math.max(w, h) * 0.14;
  const r = Math.max(w, h) * 0.026;

  return (
    <svg
      className="thumb"
      viewBox={`${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {collection.lines.map((l) => {
        const poly = layout.polys[l.id];
        if (!poly || poly.pts.length < 2) return null;
        return (
          <path
            key={l.id}
            d={pathD(poly.pts)}
            fill="none"
            stroke={l.color}
            strokeWidth={r * 1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {collection.stations.map((s) => {
        const p = layout.stations[s.id];
        return p ? <circle key={s.id} cx={p.x} cy={p.y} r={r} fill="var(--bg)" stroke="var(--fg)" strokeWidth={r * 0.35} /> : null;
      })}
    </svg>
  );
}
