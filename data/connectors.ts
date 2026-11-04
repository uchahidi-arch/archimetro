// Vocabulaire fermé : types de relations entre stations (inspirés des relations ArchiMate).
// dash = motif du trait SVG ('' = trait plein), arrow = pointe à l'arrivée.

export interface ConnectorDef {
  label: string;
  description: string;
  dash: string;
  arrow: boolean;
}

export const CONNECTORS = {
  assignment: {
    label: 'Affectation',
    description: 'Un acteur ou un rôle se voit confier un comportement.',
    dash: '',
    arrow: true,
  },
  serving: {
    label: 'Sert',
    description: 'Un élément fournit ses fonctionnalités à un autre.',
    dash: '',
    arrow: true,
  },
  flow: {
    label: 'Flux',
    description: 'Transfert d’information ou de valeur d’un élément à l’autre.',
    dash: '7 5',
    arrow: true,
  },
  triggering: {
    label: 'Déclenche',
    description: 'Un élément en déclenche un autre dans le temps.',
    dash: '2 5',
    arrow: true,
  },
  association: {
    label: 'Association',
    description: 'Lien non spécifié entre deux éléments.',
    dash: '1 6',
    arrow: false,
  },
} as const satisfies Record<string, ConnectorDef>;

export type ConnectorId = keyof typeof CONNECTORS;

export function isConnectorId(value: string): value is ConnectorId {
  return value in CONNECTORS;
}
