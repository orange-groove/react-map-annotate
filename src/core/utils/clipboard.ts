import { DUPLICATE_OFFSET_PX } from "../constants";
import type { Annotation, LngLat, MapPoint } from "../types";
import { labelAnchor } from "./annotations";
import { moveAnnotation } from "./edit";
import { createAnnotationId } from "./ids";
import { remapPastedGroupIds } from "./selection";

export const ANNOTATION_CLIPBOARD_TYPE = "application/x-rma-annotation+json";

let memoryClipboard: Annotation[] = [];

export function cloneAnnotation(annotation: Annotation): Annotation {
  const copy = JSON.parse(JSON.stringify(annotation)) as Annotation;
  copy.id = createAnnotationId();
  return copy;
}

export function serializeAnnotationClipboard(
  annotations: Annotation | Annotation[],
): string {
  const items = Array.isArray(annotations) ? annotations : [annotations];
  return JSON.stringify({ v: 2, annotations: items });
}

function asAnnotation(value: unknown): Annotation | null {
  if (!value || typeof value !== "object") return null;
  const annotation = value as Partial<Annotation>;
  if (typeof annotation.kind !== "string") return null;
  if (annotation.kind === "marker" || annotation.kind === "text") {
    return Array.isArray((annotation as { coordinate?: unknown }).coordinate)
      ? (annotation as Annotation)
      : null;
  }
  return Array.isArray((annotation as { coordinates?: unknown }).coordinates)
    ? (annotation as Annotation)
    : null;
}

export function parseAnnotationClipboard(text: string): Annotation | null {
  return parseAnnotationClipboardItems(text)[0] ?? null;
}

export function parseAnnotationClipboardItems(text: string): Annotation[] {
  try {
    const data = JSON.parse(text) as unknown;
    if (data && typeof data === "object" && "v" in data) {
      const version = (data as { v?: unknown }).v;
      if (version === 2 && "annotations" in data) {
        const items = (data as { annotations: unknown }).annotations;
        return Array.isArray(items)
          ? items.map(asAnnotation).filter((item): item is Annotation => item != null)
          : [];
      }
      if (
        version === 1 &&
        "annotation" in data
      ) {
        const item = asAnnotation((data as { annotation: unknown }).annotation);
        return item ? [item] : [];
      }
    }
    const item = asAnnotation(data);
    return item ? [item] : [];
  } catch {
    return [];
  }
}

export function writeAnnotationClipboard(
  annotations: Annotation | Annotation[],
) {
  const items = (Array.isArray(annotations) ? annotations : [annotations]).map(
    (item) => JSON.parse(JSON.stringify(item)) as Annotation,
  );
  memoryClipboard = items;
  const text = serializeAnnotationClipboard(items);
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    void clipboard.writeText(text).catch(() => undefined);
  }
}

export function peekAnnotationClipboard(): Annotation | null {
  return memoryClipboard[0] ?? null;
}

export function peekAnnotationClipboardItems(): Annotation[] {
  return memoryClipboard;
}

export async function readAnnotationClipboard(): Promise<Annotation | null> {
  const items = await readAnnotationClipboardItems();
  return items[0] ?? null;
}

export async function readAnnotationClipboardItems(): Promise<Annotation[]> {
  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard?.readText) {
    try {
      const parsed = parseAnnotationClipboardItems(await clipboard.readText());
      if (parsed.length) return parsed;
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

export function placeAnnotationsAt(
  annotations: Annotation[],
  at: LngLat,
): Annotation[] {
  const copies = remapPastedGroupIds(annotations.map(cloneAnnotation));
  const from = copies.map(labelAnchor).find((item) => item != null);
  if (!from) return copies;
  const dx = at[0] - from[0];
  const dy = at[1] - from[1];
  return copies.map((item) => {
    const anchor = labelAnchor(item);
    if (!anchor) return item;
    return moveAnnotation(item, anchor, [anchor[0] + dx, anchor[1] + dy]);
  });
}

export function offsetAnnotationsByPixels(
  annotations: Annotation[],
  project: (lngLat: LngLat) => MapPoint,
  unproject: (point: MapPoint) => LngLat,
  dx = DUPLICATE_OFFSET_PX,
  dy = 0,
): Annotation[] {
  return remapPastedGroupIds(
    annotations.map((item) =>
      offsetAnnotationByPixels(item, project, unproject, dx, dy),
    ),
  );
}

export function annotationIdFromTarget(
  target: EventTarget | null,
): string | null {
  if (!(target instanceof Element)) return null;
  return (
    target.closest("[data-rma-label]")?.getAttribute("data-rma-label") ??
    target.closest("[data-rma-marker]")?.getAttribute("data-rma-marker") ??
    null
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
      "[data-rma-label], [data-rma-handle], [data-rma-marker], .rma-overlay-marker, .mapboxgl-marker, .maplibregl-marker, .leaflet-marker-icon",
    ),
  );
}
