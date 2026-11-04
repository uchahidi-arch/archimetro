import type { Collection } from './types';

/** Le produit est livré vierge : aucune ligne, aucune station. Tout se crée depuis l'éditeur. */
export const EMPTY: Collection = {
  id: 'main',
  title: 'Nouvelle carte',
  subtitle: '',
  viewpoint: 'organisation',
  lines: [],
  stations: [],
  links: [],
};
