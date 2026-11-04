'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CONNECTORS } from '@/data/connectors';
import { QUALIFIERS } from '@/data/qualifiers';
import type { Collection, Dir } from '@/data/types';
import { applyCam, clampK, screenToWorld, TILTS, zoomLevel, zoomOfLevel, type Cam, type ViewMode } from '@/lib/camera';
import { DIR_VEC, pathD, pointAt } from '@/lib/geometry';
import { computeLayout, linkGeometry, wrapLabel } from '@/lib/layout';
import * as ops from '@/lib/ops';
import { createRepo, resolveImage } from '@/lib/repo';
import { COLORS, ExtendDialog, LineDialog, LinkDialog } from './Dialogs';
import Legend from './Legend';
import StationCard from './StationCard';
import StationEditor, { type LinkItem } from './StationEditor';
import Symbol from './Symbol';

interface Props {
  initial: Collection;
  imageBase: string;
  initialStationId?: string;
  /** Page d'édition (outils « + », panneau latéral) ou page de lecture. Défini par la route, pas par l'URL. */
  editing: boolean;
}

type DialogState =
  | { type: 'first' }
  | { type: 'branch'; stationId: string }
  | { type: 'extend'; lineId: string }
  | { type: 'link'; fromId: string; toId: string }
  | { type: 'line'; lineId: string }
  | null;

const VIEW_LABELS: Record<ViewMode, string> = { plat: 'Plat', souleve: 'Soulevé', oblique: 'Oblique' };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function MetroMap({ initial, imageBase, initialStationId, editing }: Props) {
  const repo = useMemo(() => createRepo(), []);

  // --- données -------------------------------------------------------------
  const [collection, setCollection] = useState<Collection>(initial);
  const collRef = useRef(collection);
  const syncedRef = useRef<Collection>(initial);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hydrated, setHydrated] = useState(repo.kind === 'supabase');
  // Mode local : la carte demandée n'existe pas dans ce navigateur.
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const scheduleSync = useCallback(() => {
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(() => {
      chain.current = chain.current.then(async () => {
        const next = collRef.current;
        try {
          await repo.sync(syncedRef.current, next);
          syncedRef.current = next;
          setStatus('idle');
        } catch (e) {
          setStatus('error');
          setErrMsg(e instanceof Error ? e.message : String(e));
        }
      });
    }, 500);
  }, [repo]);

  const commit = useCallback(
    (next: Collection) => {
      collRef.current = next;
      setCollection(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  useEffect(() => {
    if (repo.kind !== 'local') return;
    const saved = repo.loadLocal?.(initial.id);
    if (saved) {
      collRef.current = saved;
      syncedRef.current = saved;
      setCollection(saved);
    } else {
      setMissing(true);
    }
    setHydrated(true);
  }, [repo, initial.id]);

  // --- dérivés -------------------------------------------------------------
  const layout = useMemo(() => computeLayout(collection), [collection]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const stationById = useMemo(() => new Map(collection.stations.map((s) => [s.id, s])), [collection]);
  const lineById = useMemo(() => new Map(collection.lines.map((l) => [l.id, l])), [collection]);
  const order = useMemo(() => {
    const lines = [...collection.lines].sort((a, b) => a.position - b.position);
    return lines.flatMap((l) =>
      collection.stations.filter((s) => s.lineId === l.id).sort((a, b) => a.dist - b.dist),
    );
  }, [collection]);
  const indexById = useMemo(() => new Map(order.map((s, i) => [s.id, i])), [order]);
  const branchParents = useMemo(
    () => new Set(collection.lines.map((l) => l.parentStationId).filter((x): x is string => !!x)),
    [collection],
  );

  // --- état d'interface ----------------------------------------------------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setModeState] = useState<ViewMode>('plat');
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [pendingSel, setPendingSel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const linkFromRef = useRef(linkFrom);
  linkFromRef.current = linkFrom;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  // --- caméra ----------------------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>({ cx: 0, cy: 0, k: 1, tilt: 0, rot: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const anim = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zl, setZl] = useState(0);
  const zlRef = useRef(0);
  const Z = zoomOfLevel(zl);

  const paint = useCallback(() => {
    if (!planeRef.current || !stageRef.current) return;
    const level = zoomLevel(cam.current.k);
    if (level !== zlRef.current) {
      // Changement de palier : on redessine la géométrie à la nouvelle échelle avant d'appliquer la caméra.
      zlRef.current = level;
      flushSync(() => setZl(level));
    }
    applyCam(planeRef.current, stageRef.current, cam.current, zoomOfLevel(level));
  }, []);

  const flyTo = useCallback(
    (target: Partial<Cam>, ms = 800) => {
      cancelAnimationFrame(anim.current);
      const from = { ...cam.current };
      const to = { ...from, ...target };
      if (ms <= 0) {
        cam.current = to;
        paint();
        return;
      }
      const t0 = performance.now();
      const tick = (now: number) => {
        const u = Math.min(1, (now - t0) / ms);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        cam.current = {
          cx: from.cx + (to.cx - from.cx) * e,
          cy: from.cy + (to.cy - from.cy) * e,
          k: from.k * Math.pow(to.k / from.k, e),
          tilt: from.tilt + (to.tilt - from.tilt) * e,
          rot: from.rot + (to.rot - from.rot) * e,
        };
        paint();
        if (u < 1) anim.current = requestAnimationFrame(tick);
      };
      anim.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      setSize(sizeRef.current);
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    setSize(sizeRef.current);
    return () => ro.disconnect();
  }, []);

  /** Vue d'ensemble : toute la carte dans la zone libre (hors légende et en-tête). */
  const fit = useCallback(
    (ms = 800) => {
      const { w, h } = sizeRef.current;
      if (!w) return;
      const b = layoutRef.current.bounds;
      const pad = 110;
      const left = w > 900 && !compactRef.current && collRef.current.lines.length > 0 ? 290 : 0;
      const top = 110;
      const bottom = 50;
      const availW = w - left;
      const availH = h - top - bottom;
      const tilt = TILTS[modeRef.current];
      const ch = Math.max(Math.cos((tilt * Math.PI) / 180), 0.4);
      const k = clampK(
        Math.min(availW / (b.maxX - b.minX + pad * 2), availH / ((b.maxY - b.minY + pad * 2) * ch), 1.1),
      );
      const off = screenToWorld(left + availW / 2 - w / 2, top + availH / 2 - h / 2, { cx: 0, cy: 0, k, tilt, rot: 0 });
      flyTo({ k, tilt, rot: 0, cx: (b.minX + b.maxX) / 2 - off.x, cy: (b.minY + b.maxY) / 2 - off.y }, ms);
    },
    [flyTo],
  );
  const fitRef = useRef(fit);
  fitRef.current = fit;

  const select = useCallback(
    (id: string | null, ms = 900) => {
      setSelectedId(id);
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('station', id);
      else url.searchParams.delete('station');
      window.history.replaceState(null, '', url);

      if (!id) {
        fitRef.current(ms);
        return;
      }
      const p = layoutRef.current.stations[id];
      const { w, h } = sizeRef.current;
      if (!p || !w) return;
      // La station se place en bas de l'écran : la carte se dresse au-dessus, le plan s'incline derrière.
      const tilt = Math.max(TILTS[modeRef.current], TILTS.oblique);
      const k = 1.5;
      const off = screenToWorld(0, h * 0.3, { cx: 0, cy: 0, k, tilt, rot: 0 });
      flyTo({ k, tilt, rot: 0, cx: p.x - off.x, cy: p.y - off.y }, ms);
    },
    [flyTo],
  );
  const selectRef = useRef(select);
  selectRef.current = select;

  const setMode = useCallback(
    (m: ViewMode) => {
      setModeState(m);
      modeRef.current = m;
      if (selectedId) flyTo({ tilt: Math.max(TILTS[m], TILTS.oblique) }, 600);
      else fitRef.current(700);
    },
    [flyTo, selectedId],
  );

  // Cadrage initial, une fois la taille connue et les données chargées.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !size.w || !hydrated) return;
    fitted.current = true;
    // rAF : le premier cadrage peut changer de palier de zoom (flushSync interdit dans un effet).
    requestAnimationFrame(() => {
      if (initialStationId && layoutRef.current.stations[initialStationId]) selectRef.current(initialStationId, 0);
      else fitRef.current(0);
    });
  }, [size, hydrated, initialStationId]);

  // Sélection différée : on attend que la nouvelle station soit dans le layout.
  useEffect(() => {
    if (pendingSel && layout.stations[pendingSel]) {
      select(pendingSel);
      setPendingSel(null);
    }
  }, [pendingSel, layout, select]);

  // --- zoom molette / pincer trackpad ------------------------------------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;
      const c = cam.current;
      const k2 = clampK(c.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      const before = screenToWorld(dx, dy, c);
      const after = screenToWorld(dx, dy, { ...c, k: k2 });
      cam.current = { ...c, k: k2, cx: c.cx + before.x - after.x, cy: c.cy + before.y - after.y };
      paint();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [paint]);

  // --- glisser (déplacer), clic droit (tourner / incliner), pincer ---------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const dragKind = useRef<'pan' | 'rotate'>('pan');
  const moved = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = 0;
    cancelAnimationFrame(anim.current);
    dragKind.current = e.button === 2 || e.altKey ? 'rotate' : 'pan';
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, now);
      const c = cam.current;

      if (pointers.current.size === 1) {
        const dx = now.x - prev.x;
        const dy = now.y - prev.y;
        moved.current += Math.abs(dx) + Math.abs(dy);
        if (dragKind.current === 'rotate') {
          cam.current = { ...c, rot: clamp(c.rot + dx * 0.3, -70, 70), tilt: clamp(c.tilt - dy * 0.3, 0, 70) };
        } else {
          const w = screenToWorld(dx, dy, c);
          cam.current = { ...c, cx: c.cx - w.x, cy: c.cy - w.y };
        }
        paint();
      } else if (pointers.current.size === 2 && stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2 - rect.left - rect.width / 2;
        const my = (a.y + b.y) / 2 - rect.top - rect.height / 2;
        if (pinch.current && pinch.current > 0) {
          const k2 = clampK(c.k * (dist / pinch.current));
          const before = screenToWorld(mx, my, c);
          const after = screenToWorld(mx, my, { ...c, k: k2 });
          cam.current = { ...c, k: k2, cx: c.cx + before.x - after.x, cy: c.cy + before.y - after.y };
          paint();
        }
        pinch.current = dist;
        moved.current += 10;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [paint]);

  // --- navigation et raccourcis ---------------------------------------------------
  const step = useCallback(
    (delta: number, withinLine: boolean) => {
      if (order.length === 0) return;
      const current = selectedId ? stationById.get(selectedId) : undefined;
      if (!current) {
        select(order[0].id);
        return;
      }
      const pool = withinLine ? order.filter((s) => s.lineId === current.lineId) : order;
      const i = pool.findIndex((s) => s.id === current.id);
      select(pool[(i + delta + pool.length) % pool.length].id);
    },
    [order, selectedId, stationById, select],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.matches('input, textarea, select')) return;
      switch (e.key) {
        case 'Escape':
          if (linkFromRef.current) setLinkFrom(null);
          else if (dialog) setDialog(null);
          else select(null);
          break;
        case 'v':
        case 'V':
          fit(700);
          break;
        case 't':
        case 'T':
          setCompact((c) => !c);
          break;
        case 'b':
        case 'B':
          setDark(false);
          break;
        case 'n':
        case 'N':
          setDark(true);
          break;
        case 'ArrowRight':
          step(1, true);
          break;
        case 'ArrowLeft':
          step(-1, true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          step(1, false);
          break;
        case 'ArrowUp':
          e.preventDefault();
          step(-1, false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, fit, step, dialog]);

  // --- actions d'édition -----------------------------------------------------------
  const onStationClick = (id: string) => {
    if (moved.current >= 6) return;
    if (linkFromRef.current && linkFromRef.current !== id) {
      setDialog({ type: 'link', fromId: linkFromRef.current, toId: id });
      setLinkFrom(null);
      return;
    }
    select(id);
  };

  const onUpload = async (file: File) => {
    if (!selectedId) return;
    setUploading(true);
    try {
      const path = await repo.uploadImage(file);
      commit(ops.updateStation(collRef.current, selectedId, { imagePath: path }));
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const hasBranches = branchParents.has(selectedId);
    const msg = hasBranches
      ? 'Supprimer cette station ? Les embranchements qui en partent seront supprimés aussi.'
      : 'Supprimer cette station ?';
    if (!window.confirm(msg)) return;
    commit(ops.deleteStation(collRef.current, selectedId));
    select(null);
  };

  // --- marqueurs « + » ------------------------------------------------------------
  const markers = useMemo(() => {
    const ends: { lineId: string; x: number; y: number }[] = [];
    const mids: { lineId: string; dist: number; x: number; y: number }[] = [];
    if (!editing) return { ends, mids };
    for (const l of collection.lines) {
      const poly = layout.polys[l.id];
      if (!poly) continue;
      const last = poly.pts[poly.pts.length - 1];
      let v = { x: 0, y: 1 };
      if (poly.pts.length >= 2) {
        const prev = poly.pts[poly.pts.length - 2];
        const d = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
        v = { x: (last.x - prev.x) / d, y: (last.y - prev.y) / d };
      }
      ends.push({ lineId: l.id, x: last.x + v.x * 46, y: last.y + v.y * 46 });

      const sts = collection.stations.filter((s) => s.lineId === l.id).sort((a, b) => a.dist - b.dist);
      for (let i = 0; i < sts.length - 1; i++) {
        if (sts[i + 1].dist - sts[i].dist < 110) continue;
        const dist = (sts[i].dist + sts[i + 1].dist) / 2;
        const p = pointAt(poly, dist);
        mids.push({ lineId: l.id, dist, x: p.x, y: p.y });
      }
    }
    return { ends, mids };
  }, [editing, collection, layout]);

  // --- rendu ------------------------------------------------------------------------
  const selected = selectedId ? stationById.get(selectedId) : undefined;
  const selectedLine = selected ? lineById.get(selected.lineId) : undefined;
  const isEmpty = collection.lines.length === 0;

  const selectedLinks: LinkItem[] = selected
    ? collection.links
        .filter((l) => l.fromId === selected.id || l.toId === selected.id)
        .map((l) => {
          const outgoing = l.fromId === selected.id;
          const other = stationById.get(outgoing ? l.toId : l.fromId);
          return { id: l.id, otherTitle: other?.title ?? '', outgoing, connector: l.connector };
        })
    : [];

  const onStageClick = (e: React.MouseEvent) => {
    if (moved.current >= 6) return;
    if ((e.target as Element).closest('[data-hit]')) return;
    if (linkFrom) setLinkFrom(null);
    else if (selectedId) select(null);
  };

  if (missing) {
    return (
      <main className="page narrow">
        <h1>Carte introuvable</h1>
        <p className="page-lead">Cette carte n’existe pas dans ce navigateur, ou elle a été supprimée.</p>
        <Link href="/" className="btn primary big">
          ← Toutes les cartes
        </Link>
      </main>
    );
  }

  return (
    <div className="app" data-editing={editing ? '1' : '0'}>
      <div
        className="stage"
        ref={stageRef}
        data-lod="2"
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        onClick={onStageClick}
      >
        <div className="plane" ref={planeRef} style={{ ['--z' as string]: Z }}>
          <svg className="ground" width="1" height="1" aria-label={collection.title} role="img">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 Z" fill="var(--link)" />
              </marker>
            </defs>
            <g transform={`scale(${Z})`}>

            {collection.lines.map((l) => {
              const poly = layout.polys[l.id];
              if (!poly || poly.pts.length < 2) return null;
              const d = pathD(poly.pts);
              return (
                <g key={l.id} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d={d} stroke="var(--bg)" strokeWidth={20} />
                  <path d={d} stroke={l.color} strokeWidth={11} />
                </g>
              );
            })}

            {!compact &&
              collection.links.map((lk) => {
                const a = layout.stations[lk.fromId];
                const b = layout.stations[lk.toId];
                if (!a || !b) return null;
                const c = CONNECTORS[lk.connector];
                const hl = selectedId === lk.fromId || selectedId === lk.toId;
                return (
                  <path
                    key={lk.id}
                    d={linkGeometry(a, b).d}
                    fill="none"
                    stroke="var(--link)"
                    strokeWidth={hl ? 4 : 2.5}
                    strokeDasharray={c.dash || undefined}
                    strokeLinecap="round"
                    opacity={selectedId && !hl ? 0.25 : 0.9}
                    markerEnd={c.arrow ? 'url(#arrow)' : undefined}
                  />
                );
              })}

            {order.map((s) => {
              const p = layout.stations[s.id];
              const line = lineById.get(s.lineId);
              if (!p || !line) return null;
              const q = QUALIFIERS[s.qualifier];
              const isSel = s.id === selectedId;
              return (
                <g
                  key={s.id}
                  transform={`translate(${p.x} ${p.y})`}
                  data-hit
                  className="station"
                  onClick={() => onStationClick(s.id)}
                >
                  <circle r={32} fill="transparent" />
                  {branchParents.has(s.id) && <circle r={22} fill="var(--bg)" stroke={line.color} strokeWidth={4} />}
                  {isSel && <circle r={30} fill="none" stroke={line.color} strokeWidth={3} opacity={0.55} />}
                  <Symbol shape={q.shape} r={13} color={line.color} strokeWidth={5} />
                </g>
              );
            })}
            </g>
          </svg>

          {/* pastilles des relations, posées à plat sur le plan */}
          {!compact &&
            collection.links.map((lk) => {
              const a = layout.stations[lk.fromId];
              const b = layout.stations[lk.toId];
              if (!a || !b) return null;
              const g = linkGeometry(a, b);
              return (
                <div key={lk.id} className="pill" style={{ left: g.mid.x * Z, top: g.mid.y * Z }}>
                  {lk.label || CONNECTORS[lk.connector].label}
                </div>
              );
            })}

          {/* étiquettes à plat + plaques debout */}
          {order.map((s, i) => {
            const p = layout.stations[s.id];
            const line = lineById.get(s.lineId);
            if (!p || !line) return null;
            const q = QUALIFIERS[s.qualifier];
            const img = resolveImage(imageBase, s.imagePath);
            const isSel = s.id === selectedId;
            const showLabel = !compact || isSel;
            const title = s.title || 'Sans titre';
            return (
              <div key={s.id} className={`anchor${isSel ? ' is-sel' : ''}`} style={{ left: p.x * Z, top: p.y * Z }}>
                {showLabel && (
                  <div
                    className={`label ${p.vertical ? 'side' : 'below'}`}
                    data-hit
                    onClick={() => onStationClick(s.id)}
                  >
                    <span className="label-num">
                      {String(i + 1).padStart(2, '0')} · {q.label}
                    </span>
                    {wrapLabel(title).map((t, n) => (
                      <span key={n} className="label-title">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="shadow" style={{ ['--ox' as string]: p.vertical ? '66' : '0' }} />
                <div
                  className="plaque"
                  data-hit
                  style={{ ['--ox' as string]: p.vertical ? '66' : '0', ['--line' as string]: line.color }}
                  onClick={() => onStationClick(s.id)}
                >
                  <div className="face">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" draggable={false} />
                    ) : (
                      <div className="ph">{title}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* marqueurs d'édition */}
          {editing &&
            markers.ends.map((m) => (
              <div key={`end-${m.lineId}`} className="anchor" style={{ left: m.x * Z, top: m.y * Z }}>
                <button
                  className="plus"
                  data-hit
                  title="Prolonger la ligne"
                  onClick={() => moved.current < 6 && setDialog({ type: 'extend', lineId: m.lineId })}
                >
                  +
                </button>
              </div>
            ))}
          {editing &&
            markers.mids.map((m) => (
              <div key={`mid-${m.lineId}-${m.dist}`} className="anchor" style={{ left: m.x * Z, top: m.y * Z }}>
                <button
                  className="plus small"
                  data-hit
                  title="Insérer une carte ici"
                  onClick={() => {
                    if (moved.current >= 6) return;
                    const r = ops.insertStation(collRef.current, m.lineId, m.dist);
                    commit(r.collection);
                    setPendingSel(r.stationId);
                  }}
                >
                  +
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* en-tête */}
      <header className="head">
        <Link href="/" className="back">
          ← Toutes les cartes
        </Link>
        {editing ? (
          <>
            <input
              className="head-input title"
              value={collection.title}
              onChange={(e) => commit({ ...collRef.current, title: e.target.value })}
              aria-label="Titre de la carte"
            />
            <input
              className="head-input"
              value={collection.subtitle}
              placeholder="Sous-titre (facultatif)"
              onChange={(e) => commit({ ...collRef.current, subtitle: e.target.value })}
              aria-label="Sous-titre"
            />
          </>
        ) : (
          <>
            <h1>{collection.title}</h1>
            {collection.subtitle && <p>{collection.subtitle}</p>}
          </>
        )}
        <div className="head-meta">
          {order.length} stations · {collection.lines.length} lignes · {collection.links.length} relations
        </div>
      </header>

      {/* commandes */}
      <div className="controls">
        <div className="control-row">
          <span>Vue</span>
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}>
              {VIEW_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="control-row">
          <button onClick={() => fit(700)}>Ensemble</button>
          <kbd>V</kbd>
        </div>
        <div className="control-row">
          <span>Écran</span>
          <button onClick={() => setCompact((c) => !c)} aria-pressed={compact}>
            Épuré
          </button>
          <kbd>T</kbd>
        </div>
        <div className="control-row">
          <span>Fond</span>
          <button onClick={() => setDark(false)} aria-pressed={!dark}>
            B
          </button>
          <button onClick={() => setDark(true)} aria-pressed={dark}>
            N
          </button>
        </div>
        <div className="control-row">
          <span>Page</span>
          <Link href={`/cartes/${collection.id}`} className="navbtn" aria-current={!editing ? 'page' : undefined}>
            Voir
          </Link>
          <Link href={`/cartes/${collection.id}/edit`} className="navbtn" aria-current={editing ? 'page' : undefined}>
            Éditer
          </Link>
        </div>
      </div>

      {!compact && <Legend collection={collection} editing={editing} onEditLine={(id) => setDialog({ type: 'line', lineId: id })} />}

      <p className="hint">
        Molette / pincer : zoom · Glisser : déplacer · Clic droit + glisser : tourner et incliner · Clic : ouvrir · ← → même
        ligne · ↑ ↓ suivant · Échap : ensemble
      </p>

      {/* carte vierge */}
      {isEmpty && hydrated && (
        <div className="empty">
          <h2>Carte vierge</h2>
          {editing ? (
            <>
              <p>Commence par créer une première ligne, puis prolonge-la et ajoute des embranchements.</p>
              <button className="primary big" onClick={() => setDialog({ type: 'first' })}>
                + Créer la première ligne
              </button>
            </>
          ) : (
            <>
              <p>Cette carte est vide pour le moment.</p>
              <Link href={`/cartes/${collection.id}/edit`} className="btn primary big">
                Ouvrir l’éditeur
              </Link>
            </>
          )}
        </div>
      )}

      {/* carte debout */}
      {selected && selectedLine && (
        <StationCard
          station={selected}
          line={selectedLine}
          index={indexById.get(selected.id) ?? 0}
          imageSrc={resolveImage(imageBase, selected.imagePath)}
          onClose={() => select(null)}
          onPrev={() => step(-1, true)}
          onNext={() => step(1, true)}
        />
      )}

      {/* panneau d'édition */}
      {editing && selected && (
        <StationEditor
          station={selected}
          imageSrc={resolveImage(imageBase, selected.imagePath)}
          links={selectedLinks}
          uploading={uploading}
          onChange={(patch) => commit(ops.updateStation(collRef.current, selected.id, patch))}
          onUpload={onUpload}
          onDelete={deleteSelected}
          onBranch={() => setDialog({ type: 'branch', stationId: selected.id })}
          onLink={() => {
            setLinkFrom(selected.id);
            select(null);
          }}
          onDeleteLink={(id) => commit(ops.deleteLink(collRef.current, id))}
        />
      )}

      {linkFrom && (
        <div className="banner">
          Choisis la station d’arrivée de la relation · <button onClick={() => setLinkFrom(null)}>Annuler</button>
        </div>
      )}

      {editing && (
        <div className={`status ${status}`} role="status">
          {status === 'saving' && 'Enregistrement…'}
          {status === 'idle' && (repo.kind === 'supabase' ? 'Enregistré dans Supabase' : 'Enregistré (local)')}
          {status === 'error' && `Erreur : ${errMsg}`}
        </div>
      )}

      {/* dialogues */}
      {dialog?.type === 'first' && (
        <LineDialog
          kind="first"
          initial={{ name: '', color: COLORS[0], dir: 'S', len: 260, title: '' }}
          onCancel={() => setDialog(null)}
          onSubmit={(v) => {
            const r = ops.addFirstLine(collRef.current, { name: v.name, color: v.color, title: v.title });
            commit(r.collection);
            setDialog(null);
            setPendingSel(r.stationId);
          }}
        />
      )}

      {dialog?.type === 'branch' && (
        <LineDialog
          kind="branch"
          initial={{
            name: '',
            color: COLORS[collection.lines.length % COLORS.length],
            dir: (layout.stations[dialog.stationId]?.vertical ? 'E' : 'S') as Dir,
            len: 260,
            title: '',
          }}
          onCancel={() => setDialog(null)}
          onSubmit={(v) => {
            const r = ops.addBranch(collRef.current, dialog.stationId, {
              name: v.name,
              color: v.color,
              dir: v.dir,
              len: v.len,
              title: v.title,
            });
            commit(r.collection);
            setDialog(null);
            setPendingSel(r.stationId);
          }}
        />
      )}

      {dialog?.type === 'extend' && (
        <ExtendDialog
          lastDir={lineById.get(dialog.lineId)?.steps.at(-1)?.dir ?? null}
          onCancel={() => setDialog(null)}
          onSubmit={(v) => {
            const r = ops.extendLine(collRef.current, dialog.lineId, v);
            commit(r.collection);
            setDialog(null);
            if (r.stationId) setPendingSel(r.stationId);
          }}
        />
      )}

      {dialog?.type === 'link' && (
        <LinkDialog
          fromTitle={stationById.get(dialog.fromId)?.title ?? ''}
          toTitle={stationById.get(dialog.toId)?.title ?? ''}
          onCancel={() => setDialog(null)}
          onSubmit={(v) => {
            commit(ops.addLink(collRef.current, { fromId: dialog.fromId, toId: dialog.toId, ...v }));
            setDialog(null);
          }}
        />
      )}

      {dialog?.type === 'line' && lineById.get(dialog.lineId) && (
        <LineDialog
          kind="edit"
          initial={{
            name: lineById.get(dialog.lineId)!.name,
            color: lineById.get(dialog.lineId)!.color,
            dir: 'S',
            len: 260,
            title: '',
          }}
          onCancel={() => setDialog(null)}
          onSubmit={(v) => {
            commit(ops.updateLine(collRef.current, dialog.lineId, { name: v.name, color: v.color }));
            setDialog(null);
          }}
          onDelete={() => {
            if (!window.confirm('Supprimer cette ligne, ses cartes et ses embranchements ?')) return;
            commit(ops.deleteLine(collRef.current, dialog.lineId));
            setDialog(null);
            select(null);
          }}
        />
      )}
    </div>
  );
}
