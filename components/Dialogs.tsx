'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { CONNECTORS, type ConnectorId } from '@/data/connectors';
import type { Dir } from '@/data/types';
import { DIR_ARROW, OPPOSITE } from '@/lib/geometry';

export const COLORS = ['#a51d34', '#1f7a4d', '#3b3b98', '#d99a00', '#8e44ad', '#0e7c86', '#e0662f', '#444444'];

function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function DirPicker({
  value,
  onChange,
  disabled = [],
}: {
  value: Dir;
  onChange: (d: Dir) => void;
  disabled?: Dir[];
}) {
  const grid: (Dir | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
  return (
    <div className="dirpicker" role="group" aria-label="Direction">
      {grid.map((d, i) =>
        d ? (
          <button
            type="button"
            key={d}
            className={d === value ? 'on' : ''}
            disabled={disabled.includes(d)}
            onClick={() => onChange(d)}
            aria-label={d}
          >
            {DIR_ARROW[d]}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {COLORS.map((c) => (
        <button
          type="button"
          key={c}
          className={c === value ? 'on' : ''}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Autre couleur" />
    </div>
  );
}

function LengthField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="field">
      <span>Longueur du segment · {value}</span>
      <input type="range" min={120} max={520} step={10} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export interface LineValues {
  name: string;
  color: string;
  dir: Dir;
  len: number;
  title: string;
}

export function LineDialog({
  kind,
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  kind: 'first' | 'branch' | 'edit';
  initial: LineValues;
  onSubmit: (v: LineValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof LineValues>(k: K, val: LineValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  const heading =
    kind === 'first' ? 'Créer la première ligne' : kind === 'branch' ? 'Nouvel embranchement' : 'Modifier la ligne';

  return (
    <Modal title={heading} onCancel={onCancel}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Nom de la ligne</span>
          <input autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Direction" />
        </label>

        <div className="field">
          <span>Couleur</span>
          <ColorPicker value={v.color} onChange={(c) => set('color', c)} />
        </div>

        {kind === 'branch' && (
          <>
            <div className="field">
              <span>Direction de départ</span>
              <DirPicker value={v.dir} onChange={(d) => set('dir', d)} />
            </div>
            <LengthField value={v.len} onChange={(n) => set('len', n)} />
          </>
        )}

        {kind !== 'edit' && (
          <label className="field">
            <span>Titre de la première carte</span>
            <input value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Direction générale" />
          </label>
        )}

        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>
              Supprimer la ligne
            </button>
          )}
          <span className="grow" />
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="primary">
            {kind === 'edit' ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ExtendDialog({
  lastDir,
  onSubmit,
  onCancel,
}: {
  lastDir: Dir | null;
  onSubmit: (v: { dir: Dir; len: number; title: string }) => void;
  onCancel: () => void;
}) {
  const [dir, setDir] = useState<Dir>(lastDir ?? 'S');
  const [len, setLen] = useState(260);
  const [title, setTitle] = useState('');

  return (
    <Modal title="Prolonger la ligne" onCancel={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ dir, len, title });
        }}
      >
        <div className="field">
          <span>Direction du segment</span>
          <DirPicker value={dir} onChange={setDir} disabled={lastDir ? [OPPOSITE[lastDir]] : []} />
        </div>
        <LengthField value={len} onChange={setLen} />
        <label className="field">
          <span>Titre de la carte au bout du segment</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Comité de direction" />
        </label>
        <div className="modal-actions">
          <span className="grow" />
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="primary">
            Ajouter
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LinkDialog({
  fromTitle,
  toTitle,
  onSubmit,
  onCancel,
}: {
  fromTitle: string;
  toTitle: string;
  onSubmit: (v: { connector: ConnectorId; label: string }) => void;
  onCancel: () => void;
}) {
  const [connector, setConnector] = useState<ConnectorId>('serving');
  const [label, setLabel] = useState('');

  return (
    <Modal title="Relier deux stations" onCancel={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ connector, label });
        }}
      >
        <p className="modal-note">
          <b>{fromTitle || 'Sans titre'}</b> → <b>{toTitle || 'Sans titre'}</b>
        </p>
        <label className="field">
          <span>Type de relation</span>
          <select value={connector} onChange={(e) => setConnector(e.target.value as ConnectorId)}>
            {(Object.keys(CONNECTORS) as ConnectorId[]).map((id) => (
              <option key={id} value={id}>
                {CONNECTORS[id].label} — {CONNECTORS[id].description}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Texte sur la pastille (facultatif)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={CONNECTORS[connector].label} />
        </label>
        <div className="modal-actions">
          <span className="grow" />
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="primary">
            Relier
          </button>
        </div>
      </form>
    </Modal>
  );
}
