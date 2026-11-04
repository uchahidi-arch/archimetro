'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { createRepo } from '@/lib/repo';

/** Création d'une carte : un titre, un sous-titre facultatif, puis direction l'éditeur. */
export default function NewMapForm() {
  const router = useRouter();
  const repo = useMemo(() => createRepo(), []);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const id = await repo.create(title.trim(), subtitle.trim());
      router.push(`/cartes/${id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <Link href="/" className="back">
        ← Toutes les cartes
      </Link>
      <h1>Nouvelle carte</h1>
      <p className="page-lead">Donne un nom à ta carte. Tu pourras le modifier plus tard dans l’éditeur.</p>

      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Titre</span>
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Organisation générale"
          />
        </label>
        <label className="field">
          <span>Sous-titre (facultatif)</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex. Point de vue Organisation" />
        </label>

        {error && <p className="page-error">Erreur : {error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn primary big" disabled={busy || !title.trim()}>
            {busy ? 'Création…' : 'Créer et ouvrir l’éditeur'}
          </button>
          <Link href="/" className="btn big">
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
