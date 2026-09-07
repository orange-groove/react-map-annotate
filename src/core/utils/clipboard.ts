import { DUPLICATE_OFFSET_PX } from "../constants";
import type { Annotation, LngLat, MapPoint } from "../types";
import { labelAnchor } from "./annotations";
import { moveAnnotation } from "./edit";
import { createAnnotationId } from "./ids";

export const ANNOTATION_CLIPBOARD_TYPE = "application/x-rma-annotation+json";

let memoryClipboard: Annotation | null = null;

export function cloneAnnotation(annotation: Annotation): Annotation {
  const copy = JSON.parse(JSON.stringify(annotation)) as Annotation;
  copy.id = createAnnotationId();
  return copy;
}

export function serializeAnnotationClipboard(annotation: Annotation): string {
  return JSON.stringify({ v: 1, annotation });
}

export function parseAnnotationClipboard(text: string): Annotation | null {
  try {
    const data = JSON.parse(text) as unknown;
    const wrapped =
      data &&
      typeof data === "object" &&
      "v" in data &&
      (data as { v?: unknown }).v === 1 &&
      "annotation" in data
        ? (data as { annotation: unknown }).annotation
        : data;
    if (!wrapped || typeof wrapped !== "object") return null;
    const annotation = wrapped as Partial<Annotation>;
    if (typeof annotation.kind !== "string") return null;
    if (annotation.kind === "marker" || annotation.kind === "text") {
      return Array.isArray((annotation as { coordinate?: unknown }).coordinate)
        ? (annotation as Annotation)
        : null;
    }
    return Array.isArray((annotation as { coordinates?: unknown }).coordinates)
      ? (annotation as Annotation)
      : null;
  } catch {
    return null;
  }
}

export function writeAnnotationClipboard(annotation: Annotation) {
  memoryClipboard = JSON.parse(JSON.stringify(annotation)) as Annotation;
  const text = serializeAnnotationClipboard(annotation);
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    void clipboard.writeText(text).catch(() => undefined);
  }
}

export function peekAnnotationClipboard(): Annotation | null {
  return memoryClipboard;
}

export async function readAnnotationClipboard(): Promise<Annotation | null> {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.readText) {
    try {
      const parsed = parseAnnotationClipboard(await clipboard.readText());
      if (parsed) return parsed;
    } catch {
      // Permissions or empty clipboard — fall back to the in-memory copy.
    }
  }
  return memoryClipboard;
}

export function placeAnnotationAt(
  annotation: Annotation,
  at: LngLat,
): Annotation {
  const copy = cloneAnnotation(annotation);
  const from = labelAnchor(copy);
  if (!from) return copy;
  return moveAnnotation(copy, from, at);
}

export function offsetAnnotationByPixels(
  annotation: Annotation,
  project: (lngLat: LngLat) => MapPoint,
  unproject: (point: MapPoint) => LngLat,
  dx: number,
  dy = 0,
): Annotation {
  const copy = cloneAnnotation(annotation);
  const from = labelAnchor(copy);
  if (!from) return copy;
  const screen = project(from);
  return moveAnnotation(
    copy,
    from,
    unproject({ x: screen.x + dx, y: screen.y + dy }),
  );
}

export function duplicateAnnotationRight(
  annotation: Annotation,
  project: (lngLat: LngLat) => MapPoint,
  unproject: (point: MapPoint) => LngLat,
  pixels = DUPLICATE_OFFSET_PX,
): Annotation {
  return offsetAnnotationByPixels(annotation, project, unproject, pixels, 0);
}

export function annotationIdFromTarget(
  target: EventTarget | null,
): string | null {
  if (!(target instanceof Element)) return null;
  return (
    target.closest("[data-rma-label]")?.getAttribute("data-rma-label") ?? null
  );
}

export function isMapChromeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      ".rma-toolbar, .rma-list, .rma-menu, input, textarea, select",
    ),
  );
}

export function isMapOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "[data-rma-label], [data-rma-handle], .rma-overlay-marker, .mapboxgl-marker, .maplibregl-marker, .leaflet-marker-icon",
    ),
  );
}
