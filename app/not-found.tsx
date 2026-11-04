import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page narrow">
      <h1>Carte introuvable</h1>
      <p className="page-lead">Cette carte n’existe pas, ou elle a été supprimée.</p>
      <Link href="/" className="btn primary big">
        ← Toutes les cartes
      </Link>
    </main>
  );
}
