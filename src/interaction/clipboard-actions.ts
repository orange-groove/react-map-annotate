import type { Annotation, LngLat } from "../core/types";
import {
  annotationIdFromTarget,
  duplicateAnnotationRight,
  isMapChromeTarget,
  isMapOverlayTarget,
  placeAnnotationAt,
  readAnnotationClipboard,
  writeAnnotationClipboard,
} from "../core/utils/clipboard";
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

function addCopy(latest: MapDrawingLatest, annotation: Annotation) {
  latest.onAdd?.(annotation);
  latest.onSelect?.(annotation.id);
}

export function copySelectedAnnotation(
  latest: MapDrawingLatest,
  id = latest.selectedId,
): boolean {
  const annotation = latest.annotations.find((item) => item.id === id);
  if (!annotation) return false;
  writeAnnotationClipboard(annotation);
  return true;
}

export function duplicateSelectedAnnotation(
  latest: MapDrawingLatest,
  map: MapLike | null,
  id = latest.selectedId,
): boolean {
  const annotation = latest.annotations.find((item) => item.id === id);
  if (!annotation) return false;
  const copy = map
    ? duplicateAnnotationRight(
        annotation,
        projectors(map).project,
        projectors(map).unproject,
      )
    : cloneFallback(annotation);
  addCopy(latest, copy);
  return true;
}

function cloneFallback(annotation: Annotation): Annotation {
  return placeAnnotationAt(annotation, shiftEast(annotation));
}

function shiftEast(annotation: Annotation): LngLat {
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
  const source = await readAnnotationClipboard();
  if (!source) return false;
  const copy = at
    ? placeAnnotationAt(source, at)
    : map
      ? duplicateAnnotationRight(
          source,
          projectors(map).project,
          projectors(map).unproject,
        )
      : cloneFallback(source);
  addCopy(latest, copy);
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
