'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page narrow">
      <h1>Un problème est survenu</h1>
      <p className="page-lead">{error.message || 'Impossible de charger cette page.'}</p>
      <div className="form-actions">
        <button type="button" className="btn primary big" onClick={reset}>
          Réessayer
        </button>
        <Link href="/" className="btn big">
          Accueil
        </Link>
      </div>
    </main>
  );
}
