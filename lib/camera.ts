/** Caméra du plan 3D : point du monde au centre de l'écran, zoom, inclinaison et rotation. */
export interface Cam {
  cx: number;
  cy: number;
  k: number;
  /** Inclinaison du plan en degrés (0 = vue de dessus). */
  tilt: number;
  /** Rotation du plan en degrés. */
  rot: number;
}

export type ViewMode = 'plat' | 'souleve' | 'oblique';

export const TILTS: Record<ViewMode, number> = { plat: 0, souleve: 30, oblique: 56 };

export const MIN_K = 0.08;
export const MAX_K = 4;
export const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

const rad = (d: number): number => (d * Math.PI) / 180;

/**
 * Convertit un décalage en pixels depuis le centre de l'écran en décalage dans le monde.
 * Approximation sans perspective : on défait le raccourci de l'inclinaison, puis la rotation, puis le zoom.
 */
export function screenToWorld(dx: number, dy: number, cam: Cam): { x: number; y: number } {
  const c = Math.max(Math.cos(rad(cam.tilt)), 0.35);
  const ys = dy / c;
  const r = rad(-cam.rot);
  return {
    x: (dx * Math.cos(r) - ys * Math.sin(r)) / cam.k,
    y: (dx * Math.sin(r) + ys * Math.cos(r)) / cam.k,
  };
}

/** Écrit la caméra dans le DOM (transform + variables CSS lues par les plaques et les ombres). */
/**
 * Netteté du zoom : un contenu transformé en 3D n'est pas re-rastérisé par Chrome quand on change
 * l'échelle CSS, donc tout devient flou en zoomant. On « pré-multiplie » donc le zoom dans la
 * géométrie par paliers (×1,5) : le DOM est dessiné à l'échelle Z du palier, et la transformation
 * CSS ne corrige plus que l'écart restant (k / Z, entre ×0,82 et ×1,22).
 */
export const ZOOM_STEP = 1.5;
export const zoomLevel = (k: number): number => Math.round(Math.log(k) / Math.log(ZOOM_STEP));
export const zoomOfLevel = (level: number): number => Math.pow(ZOOM_STEP, level);

export function applyCam(plane: HTMLElement, stage: HTMLElement, cam: Cam, z: number): void {
  plane.style.transform = `rotateX(${cam.tilt}deg) rotateZ(${cam.rot}deg) scale(${cam.k / z}) translate(${-cam.cx * z}px, ${-cam.cy * z}px)`;
  plane.style.setProperty('--tilt', `${cam.tilt}deg`);
  plane.style.setProperty('--rot', `${cam.rot}deg`);
  plane.style.setProperty('--k', String(cam.k));
  // Plus on zoome (et plus on incline), plus les plaques semblent « décollées » : l'ombre s'allonge.
  const lift = Math.min(1.6, Math.max(0.15, (cam.k - 0.2) * 0.9)) * (0.5 + Math.min(cam.tilt, 60) / 120);
  plane.style.setProperty('--lift', lift.toFixed(3));
  // Niveaux de détail : 0 = lignes seules, 1 = plaques, 2 = plaques et étiquettes.
  stage.dataset.lod = cam.k < 0.3 ? '0' : cam.k < 0.6 ? '1' : '2';
}
