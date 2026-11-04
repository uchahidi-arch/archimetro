'use client';

import { useRef } from 'react';
import { CONNECTORS } from '@/data/connectors';
import { QUALIFIERS, type QualifierId } from '@/data/qualifiers';
import type { Station } from '@/data/types';

export interface LinkItem {
  id: string;
  otherTitle: string;
  outgoing: boolean;
  connector: keyof typeof CONNECTORS;
}

interface Props {
  station: Station;
  imageSrc: string;
  links: LinkItem[];
  uploading: boolean;
  onChange: (patch: Partial<Station>) => void;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onBranch: () => void;
  onLink: () => void;
  onDeleteLink: (id: string) => void;
}

/** Panneau d'édition de la station sélectionnée (mode édition uniquement). */
export default function StationEditor({
  station,
  imageSrc,
  links,
  uploading,
  onChange,
  onUpload,
  onDelete,
  onBranch,
  onLink,
  onDeleteLink,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const tasks = [...station.tasks].sort((a, b) => a.position - b.position);

  const setTask = (id: string, label: string) =>
    onChange({ tasks: station.tasks.map((t) => (t.id === id ? { ...t, label } : t)) });
  const addTask = () =>
    onChange({
      tasks: [...station.tasks, { id: crypto.randomUUID(), label: '', position: station.tasks.length }],
    });
  const removeTask = (id: string) =>
    onChange({ tasks: station.tasks.filter((t) => t.id !== id).map((t, i) => ({ ...t, position: i })) });

  return (
    <aside className="editor" aria-label="Édition de la station" onPointerDown={(e) => e.stopPropagation()}>
      <h2>Éditer la carte</h2>

      <label className="field">
        <span>Titre</span>
        <input value={station.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Titre de la carte" />
      </label>

      <div className="field">
        <span>Photo</span>
        <div className="photo-row">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className="photo-prev" />
          ) : (
            <div className="photo-prev none">Aucune</div>
          )}
          <div className="photo-btns">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Envoi…' : imageSrc ? 'Remplacer' : 'Ajouter'}
            </button>
            {imageSrc && (
              <button type="button" onClick={() => onChange({ imagePath: null })}>
                Retirer
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <label className="field">
        <span>Description</span>
        <textarea
          rows={4}
          value={station.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Ce que fait cette entité, son rôle…"
        />
      </label>

      <label className="field">
        <span>Type</span>
        <select value={station.qualifier} onChange={(e) => onChange({ qualifier: e.target.value as QualifierId })}>
          {(Object.keys(QUALIFIERS) as QualifierId[]).map((id) => (
            <option key={id} value={id}>
              {QUALIFIERS[id].label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Opérations</span>
        <div className="tasks-edit">
          {tasks.map((t) => (
            <div key={t.id} className="task-row">
              <input value={t.label} onChange={(e) => setTask(t.id, e.target.value)} placeholder="Opération" />
              <button type="button" onClick={() => removeTask(t.id)} aria-label="Supprimer l’opération">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addTask}>
            + Ajouter une opération
          </button>
        </div>
      </div>

      <label className="field">
        <span>Source</span>
        <input value={station.source ?? ''} onChange={(e) => onChange({ source: e.target.value })} />
      </label>
      <label className="field">
        <span>Lien</span>
        <input value={station.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://" />
      </label>

      {links.length > 0 && (
        <div className="field">
          <span>Relations</span>
          <ul className="links-edit">
            {links.map((l) => (
              <li key={l.id}>
                <span>
                  {l.outgoing ? '→' : '←'} {CONNECTORS[l.connector].label} · {l.otherTitle || 'Sans titre'}
                </span>
                <button type="button" onClick={() => onDeleteLink(l.id)} aria-label="Supprimer la relation">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="editor-actions">
        <button type="button" onClick={onBranch}>
          ⑂ Embranchement
        </button>
        <button type="button" onClick={onLink}>
          ⇢ Relier à…
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          Supprimer
        </button>
      </div>
    </aside>
  );
}
