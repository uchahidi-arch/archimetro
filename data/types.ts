import type { ConnectorId } from './connectors';
import type { QualifierId } from './qualifiers';

/** Les 8 directions autorisées : un plan de métro n'a que des horizontales, verticales et diagonales à 45°. */
export type Dir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Un segment du tracé d'une ligne : une direction et une longueur. */
export interface Step {
  dir: Dir;
  len: number;
}

/**
 * Une ligne de métro. Son tracé est une suite de segments (steps) ; les coins sont arrondis
 * par le moteur. Une branche part de la station parentStationId ; la ligne principale part de origin.
 */
export interface Line {
  id: string;
  name: string;
  color: string;
  parentStationId: string | null;
  origin: { x: number; y: number };
  steps: Step[];
  position: number;
}

/** Une opération / tâche qui incombe à la station. */
export interface Task {
  id: string;
  label: string;
  description?: string;
  position: number;
}

/** Une station (une carte) posée sur une ligne, à la distance `dist` le long du tracé. */
export interface Station {
  id: string;
  lineId: string;
  dist: number;
  qualifier: QualifierId;
  title: string;
  description?: string;
  imagePath?: string | null;
  source?: string | null;
  url?: string | null;
  tasks: Task[];
}

/** Relation entre deux stations (type pris dans la liste fermée des connecteurs). */
export interface Link {
  id: string;
  fromId: string;
  toId: string;
  connector: ConnectorId;
  label?: string;
}

/** Une carte complète. */
export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  viewpoint: string;
  lines: Line[];
  stations: Station[];
  links: Link[];
}
