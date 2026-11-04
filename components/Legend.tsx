import { CONNECTORS } from '@/data/connectors';
import { QUALIFIERS } from '@/data/qualifiers';
import type { Collection } from '@/data/types';
import Symbol from './Symbol';

interface Props {
  collection: Collection;
  editing: boolean;
  onEditLine: (lineId: string) => void;
}

/** Légende générée à partir des données : rien n'est écrit à la main. */
export default function Legend({ collection, editing, onEditLine }: Props) {
  if (collection.lines.length === 0) return null;

  const usedQualifiers = Object.entries(QUALIFIERS).filter(([id]) =>
    collection.stations.some((s) => s.qualifier === id),
  );
  const usedConnectors = Object.entries(CONNECTORS).filter(([id]) =>
    collection.links.some((l) => l.connector === id),
  );

  return (
    <aside className="legend" aria-label="Légende">
      {usedQualifiers.length > 0 && (
        <>
          <h2>Rôles</h2>
          <ul>
            {usedQualifiers.map(([id, q]) => (
              <li key={id} title={q.description}>
                <svg width="22" height="22" viewBox="-14 -14 28 28" aria-hidden="true">
                  <Symbol shape={q.shape} r={7} color="var(--fg)" strokeWidth={2.5} />
                </svg>
                <span>{q.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Lignes</h2>
      <ul>
        {[...collection.lines]
          .sort((a, b) => a.position - b.position)
          .map((l) => (
            <li key={l.id}>
              <span className="swatch" style={{ background: l.color }} />
              <span>{l.name}</span>
              {editing && (
                <button className="legend-edit" onClick={() => onEditLine(l.id)} aria-label={`Modifier ${l.name}`}>
                  ✎
                </button>
              )}
            </li>
          ))}
      </ul>

      {usedConnectors.length > 0 && (
        <>
          <h2>Relations</h2>
          <ul>
            {usedConnectors.map(([id, c]) => (
              <li key={id} title={c.description}>
                <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
                  <line
                    x1="1"
                    y1="6"
                    x2={c.arrow ? 16 : 21}
                    y2="6"
                    stroke="var(--link)"
                    strokeWidth="2"
                    strokeDasharray={c.dash || undefined}
                  />
                  {c.arrow && <path d="M15 2 L21 6 L15 10 Z" fill="var(--link)" />}
                </svg>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
