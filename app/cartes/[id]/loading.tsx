/** Affiché instantanément pendant le chargement d'une carte (lecture ou édition). */
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="spinner" />
      <p>Chargement de la carte…</p>
    </div>
  );
}
