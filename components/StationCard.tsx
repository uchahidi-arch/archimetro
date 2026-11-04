'use client';

import { useState } from 'react';
import { QUALIFIERS } from '@/data/qualifiers';
import type { Line, Station } from '@/data/types';
import Symbol from './Symbol';

interface Props {
  station: Station;
  line: Line;
  index: number;
  imageSrc: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/** Ratio du cadre photo quand il n'y a pas de photo (bandeau de couleur). */
const NO_PHOTO_RATIO = 2.2;
/** Bornes du ratio largeur / hauteur : au-delà, la photo est très légèrement recadrée. */
const MIN_RATIO = 0.7;
const MAX_RATIO = 2;

/** La carte qui se redresse au clic sur une station. */
export default function StationCard({ station, line, index, imageSrc, onClose, onPrev, onNext }: Props) {
  const q = QUALIFIERS[station.qualifier];
  const tasks = [...station.tasks].sort((a, b) => a.position - b.position);
  const number = String(index + 1).padStart(2, '0');

  // Ratio réel de la photo, lu au chargement : le cadre épouse la photo au lieu de la rogner.
  const [ratio, setRatio] = useState<number | null>(null);
  const frameRatio = imageSrc ? (ratio ?? 1.4) : NO_PHOTO_RATIO;
  // Largeur de la carte selon le format de la photo : plus la photo est haute, plus la carte est étroite,
  // pour garder de la place au texte.
  const shape = !imageSrc || ratio === null ? '' : ratio < 0.9 ? ' portrait' : ratio <= 1.2 ? ' square' : '';

  return (
    <div className={`card3d${shape}`} key={station.id}>
      <i className="br tl" />
      <i className="br tr" />
      <i className="br bl" />
      <i className="br bb" />
      <article className="card" aria-label={station.title || 'Station sans titre'}>
        <div
          className="card-media"
          style={{ ['--line' as string]: line.color, ['--ratio' as string]: frameRatio }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, w / h)));
              }}
            />
          ) : (
            <svg viewBox="-60 -40 120 80" aria-hidden="true">
              <Symbol shape={q.shape} r={22} color="#fff" fill="transparent" strokeWidth={5} />
            </svg>
          )}
          <span className="card-badge">
            <b>{number}</b>
            <i />
            {q.label}
          </span>
          <button className="card-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="card-body">
          <div className="card-scroll">
          <h3>{station.title || 'Sans titre'}</h3>
          {station.description && <p className="card-desc">{station.description}</p>}

          {tasks.length > 0 && (
            <>
              <h4>Opérations</h4>
              <ol className="card-tasks">
                {tasks.map((t) => (
                  <li key={t.id}>{t.label || '…'}</li>
                ))}
              </ol>
            </>
          )}
          </div>

          <div className="card-foot">
            <span className="card-line">
              <span className="swatch" style={{ background: line.color }} /> {line.name}
              {station.source ? ` · ${station.source}` : ''}
            </span>
            <span className="card-nav">
              <button onClick={onPrev} aria-label="Station précédente">
                ←
              </button>
              <button onClick={onNext} aria-label="Station suivante">
                →
              </button>
            </span>
          </div>
          {station.url && (
            <a className="card-link" href={station.url} target="_blank" rel="noreferrer">
              Ouvrir le lien ↗
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
