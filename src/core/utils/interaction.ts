import type { LngLat } from "../types";

export const handleInteraction = { suppressClickUntil: 0 };
const DRAG_CURSOR_CLASS = "rma-dragging";

export function setMapCursor(
  map: { getCanvas: () => HTMLElement | null },
  cursor: string,
) {
  const canvas = map.getCanvas();
  if (!canvas?.style) return;
  canvas.style.cursor = cursor;
  const host = canvas.parentElement;
  if (host?.style) host.style.cursor = cursor;
}

export function setPointerCursor(cursor: string | null) {
  const root = document.documentElement;
  if (!cursor) {
    root.classList.remove(DRAG_CURSOR_CLASS);
    root.style.removeProperty("--rma-pointer-cursor");
    return;
  }
  root.style.setProperty("--rma-pointer-cursor", cursor);
  root.classList.add(DRAG_CURSOR_CLASS);
}

export function isUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "[data-rma-label], [data-rma-handle], .mapboxgl-marker, .maplibregl-marker, .leaflet-marker-icon, .rma-overlay-marker, .rma-toolbar, .rma-menu, input, textarea",
    ),
  );
}

export function lastTwoEqual(coordinates: LngLat[]): boolean {
  if (coordinates.length < 2) return false;
  const a = coordinates[coordinates.length - 2];
  const b = coordinates[coordinates.length - 1];
  return a[0] === b[0] && a[1] === b[1];
}

export function nearFirstVertex(
  map: {
    project: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
  },
  first: LngLat,
  current: LngLat,
): boolean {
  const a = map.project({ lng: first[0], lat: first[1] });
  const b = map.project({ lng: current[0], lat: current[1] });
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= 144;
}

export function eventLngLat(event: {
  lngLat: { lng: number; lat: number };
}): LngLat {
  return [event.lngLat.lng, event.lngLat.lat];
}

export function clientToLngLat(
  map: {
    getCanvas: () => HTMLElement;
    unproject: (point: [number, number]) => { lng: number; lat: number };
  },
  clientX: number,
  clientY: number,
): LngLat {
  const rect = map.getCanvas().getBoundingClientRect();
  const point = map.unproject([clientX - rect.left, clientY - rect.top]);
  return [point.lng, point.lat];
}
