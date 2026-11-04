'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Collection } from '@/data/types';
import { createRepo } from '@/lib/repo';
import MapThumb from '../MapThumb';

/** Page d'accueil : le nombre de cartes disponibles, avec « Ajouter une carte » et « Ouvrir » / « Éditer ». */
export default function MapsHome({ initial }: { initial: Collection[] }) {
  const repo = useMemo(() => createRepo(), []);
  const [maps, setMaps] = useState(initial);
  // Avec Supabase, la liste vient du serveur. En mode local, elle est lue dans le navigateur.
  const [ready, setReady] = useState(repo.kind === 'supabase');
  const [error, setError] = useState('');

  useEffect(() => {
    if (repo.kind !== 'local') return;
    repo.list().then((m) => {
      setMaps(m);
      setReady(true);
    });
  }, [repo]);

  const remove = async (m: Collection) => {
    if (!window.confirm(`Supprimer la carte « ${m.title} » et tout son contenu ?`)) return;
    try {
      await repo.remove(m.id);
      setMaps((list) => list.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const count = maps.length;

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>ArchiMétro</h1>
          <p>Plans de métro de l’organisation</p>
        </div>
        <div className="page-count" aria-live="polite">
          {ready ? (
            <>
              <b>{count}</b> carte{count > 1 ? 's' : ''} disponible{count > 1 ? 's' : ''}
            </>
          ) : (
            'Chargement…'
          )}
        </div>
      </header>

      {error && <p className="page-error">Erreur : {error}</p>}

      {ready && count === 0 && (
        <section className="page-empty">
          <h2>Aucune carte pour le moment</h2>
          <p>Crée ta première carte, puis construis-la ligne par ligne dans l’éditeur.</p>
          <Link href="/cartes/nouvelle" className="btn primary big">
            + Ajouter une carte
          </Link>
        </section>
      )}

      {ready && count > 0 && (
        <section className="map-grid" aria-label="Cartes">
          {maps.map((m) => (
            <article key={m.id} className="map-card">
              <Link href={`/cartes/${m.id}`} className="map-card-thumb" aria-label={`Ouvrir ${m.title}`}>
                <MapThumb collection={m} />
              </Link>
              <div className="map-card-body">
                <h2>{m.title || 'Sans titre'}</h2>
                {m.subtitle && <p>{m.subtitle}</p>}
                <div className="map-card-meta">
                  {m.lines.length} ligne{m.lines.length > 1 ? 's' : ''} · {m.stations.length} station
                  {m.stations.length > 1 ? 's' : ''}
                </div>
                <div className="map-card-actions">
                  <Link href={`/cartes/${m.id}`} className="btn primary">
                    Ouvrir
                  </Link>
                  <Link href={`/cartes/${m.id}/edit`} className="btn">
                    Éditer
                  </Link>
                  <button type="button" className="btn danger" onClick={() => remove(m)}>
                    Supprimer
                  </button>
                </div>
              </div>
            </article>
          ))}

          <Link href="/cartes/nouvelle" className="map-card add">
            <span>+</span>
            Ajouter une carte
          </Link>
        </section>
      )}
    </main>
  );
}
