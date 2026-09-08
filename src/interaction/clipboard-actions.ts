import type { Annotation, LngLat } from "../core/types";
import {
  annotationIdFromTarget,
  isMapChromeTarget,
  isMapOverlayTarget,
  offsetAnnotationsByPixels,
  placeAnnotationAt,
  placeAnnotationsAt,
  readAnnotationClipboardItems,
  writeAnnotationClipboard,
} from "../core/utils/clipboard";
import { expandGroupIds } from "../core/utils/selection";
import { clientToLngLat } from "../core/utils/interaction";
import type { MapLike } from "../engines/kit/types";
import { hitAnnotationId } from "./hit";
import type { MapDrawingLatest } from "./use-map-drawing";

function projectors(map: MapLike) {
  return {
    project: (lngLat: LngLat) =>
      map.project({ lng: lngLat[0], lat: lngLat[1] }),
    unproject: (point: { x: number; y: number }): LngLat => {
      const next = map.unproject([point.x, point.y]);
      return [next.lng, next.lat];
    },
  };
}

export function selectedAnnotationIds(
  latest: MapDrawingLatest,
  ids?: string[] | string | null,
): string[] {
  if (Array.isArray(ids)) return expandGroupIds(latest.annotations, ids);
  if (typeof ids === "string") {
    return expandGroupIds(latest.annotations, [ids]);
  }
  if (latest.selectedIds?.length) {
    return expandGroupIds(latest.annotations, latest.selectedIds);
  }
  if (latest.selectedId) {
    return expandGroupIds(latest.annotations, [latest.selectedId]);
  }
  return [];
}

function selectedAnnotations(
  latest: MapDrawingLatest,
  ids?: string[] | string | null,
): Annotation[] {
  const wanted = new Set(selectedAnnotationIds(latest, ids));
  return latest.annotations.filter((item) => wanted.has(item.id));
}

function addCopies(latest: MapDrawingLatest, copies: Annotation[]) {
  if (copies.length === 0) return;
  if (latest.onAddMany) {
    latest.onAddMany(copies);
    return;
  }
  for (const copy of copies) latest.onAdd?.(copy);
  latest.setSelectedIds?.(copies.map((item) => item.id));
  latest.onSelect?.(copies[copies.length - 1]?.id ?? null);
}

export function copySelectedAnnotation(
  latest: MapDrawingLatest,
  ids?: string[] | string | null,
): boolean {
  const items = selectedAnnotations(latest, ids);
  if (!items.length) return false;
  writeAnnotationClipboard(items);
  return true;
}

export function duplicateSelectedAnnotation(
  latest: MapDrawingLatest,
  map: MapLike | null,
  ids?: string[] | string | null,
): boolean {
  const items = selectedAnnotations(latest, ids);
  if (!items.length) return false;
  const copies = map
    ? offsetAnnotationsByPixels(
        items,
        projectors(map).project,
        projectors(map).unproject,
      )
    : cloneFallbacks(items);
  addCopies(latest, copies);
  return true;
}

function cloneFallbacks(annotations: Annotation[]): Annotation[] {
  return placeAnnotationsAt(
    annotations,
    shiftEast(annotations[0]),
  );
}

function shiftEast(annotation: Annotation | undefined): LngLat {
  if (!annotation) return [0, 0];
  const from =
    annotation.kind === "marker" || annotation.kind === "text"
      ? annotation.coordinate
      : annotation.kind === "circle" && annotation.center
        ? annotation.center
        : annotation.coordinates[0];
  return from ? [from[0] + 0.0004, from[1]] : [0, 0];
}

export async function pasteAnnotationAtPointer(
  latest: MapDrawingLatest,
  at: LngLat | null,
  map: MapLike | null,
): Promise<boolean> {
  const sources = await readAnnotationClipboardItems();
  if (!sources.length) return false;
  const copies = at
    ? placeAnnotationsAt(sources, at)
    : map
      ? offsetAnnotationsByPixels(
          sources,
          projectors(map).project,
          projectors(map).unproject,
        )
      : cloneFallbacks(sources);
  addCopies(latest, copies);
  return true;
}

export interface AnnotationContextMenuState {
  x: number;
  y: number;
  lngLat: LngLat;
  annotationId: string | null;
}

function mapRoot(canvas: HTMLElement): HTMLElement {
  return (
    canvas.closest(
      ".mapboxgl-map, .maplibregl-map, .leaflet-container, .esri-view, [data-rma-map]",
    ) ??
    canvas.parentElement ??
    canvas
  );
}

export function resolveAnnotationContextMenu(
  event: MouseEvent,
  {
    latest,
    map,
  }: {
    latest: MapDrawingLatest;
    map: MapLike;
  },
): AnnotationContextMenuState | null {
  if (isMapChromeTarget(event.target)) return null;
  const canvas = map.getCanvas();
  const fromLabel = annotationIdFromTarget(event.target);
  const root = mapRoot(canvas);
  const onMap =
    (event.target instanceof Node &&
      (canvas.contains(event.target) ||
        root.contains(event.target) ||
        event.target === canvas)) ||
    Boolean(fromLabel) ||
    isMapOverlayTarget(event.target);
  if (!onMap) return null;

  event.preventDefault();
  event.stopPropagation();
  const lngLat = clientToLngLat(map, event.clientX, event.clientY);
  const point = map.project({ lng: lngLat[0], lat: lngLat[1] });
  const hitId = fromLabel ?? hitAnnotationId(map, point, latest.annotations);
  return {
    x: event.clientX,
    y: event.clientY,
    lngLat,
    annotationId: hitId,
  };
}
