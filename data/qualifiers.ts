// Vocabulaire fermé : les types d'éléments (qualifieurs) du point de vue « Organisation » ArchiMate.
// Pour ajouter un type : une entrée ici, il apparaît automatiquement dans la légende et sur le plan.

export type SymbolShape =
  | 'ring'
  | 'dot'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'hex'
  | 'half'
  | 'bar';

export interface QualifierDef {
  label: string;
  description: string;
  shape: SymbolShape;
}

export const QUALIFIERS = {
  acteur: {
    label: 'Acteur',
    description: 'Entité organisationnelle capable d’agir : direction, département, personne.',
    shape: 'ring',
  },
  role: {
    label: 'Rôle',
    description: 'Responsabilité assignée à un acteur.',
    shape: 'half',
  },
  collaboration: {
    label: 'Collaboration',
    description: 'Ensemble d’acteurs qui travaillent ensemble (comité, équipe projet).',
    shape: 'hex',
  },
  interface: {
    label: 'Interface',
    description: 'Point d’accès par lequel un service est rendu.',
    shape: 'triangle',
  },
  processus: {
    label: 'Processus',
    description: 'Suite d’activités qui produit un résultat.',
    shape: 'dot',
  },
  fonction: {
    label: 'Fonction',
    description: 'Regroupement de comportements selon un domaine de compétence.',
    shape: 'square',
  },
  evenement: {
    label: 'Événement',
    description: 'Fait qui déclenche ou résulte d’un comportement.',
    shape: 'diamond',
  },
  service: {
    label: 'Service',
    description: 'Comportement rendu visible à l’extérieur.',
    shape: 'bar',
  },
} as const satisfies Record<string, QualifierDef>;

export type QualifierId = keyof typeof QUALIFIERS;

export function isQualifierId(value: string): value is QualifierId {
  return value in QUALIFIERS;
}
