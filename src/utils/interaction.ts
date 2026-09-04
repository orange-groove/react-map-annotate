import type { LngLat } from "../types";

export const handleInteraction = { suppressClickUntil: 0 };

export function isUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "[data-rmga-label], [data-rmga-handle], .mapboxgl-marker, .rmga-toolbar, input, textarea",
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
    getCanvas: () => HTMLCanvasElement;
    unproject: (point: [number, number]) => { lng: number; lat: number };
  },
  clientX: number,
  clientY: number,
): LngLat {
  const rect = map.getCanvas().getBoundingClientRect();
  const point = map.unproject([clientX - rect.left, clientY - rect.top]);
  return [point.lng, point.lat];
}
