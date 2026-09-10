import type { Annotation, LngLat } from "../core/types";

export const HISTORY_LIMIT = 50;

export function cloneAnnotations(items: Annotation[]): Annotation[] {
  return structuredClone(items);
}

export function annotationsEqual(a: Annotation[], b: Annotation[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function samePoint(a: LngLat | undefined, b: LngLat | undefined): boolean {
  if (!a || !b) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

function samePath(a: LngLat[] | undefined, b: LngLat[] | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  return a.every((point, index) => samePoint(point, b[index]));
}

function sameAnnotationGeometry(a: Annotation, b: Annotation): boolean {
  if (a.id !== b.id || a.kind !== b.kind) return false;
  if ("coordinate" in a || "coordinate" in b) {
    const left = "coordinate" in a ? a.coordinate : undefined;
    const right = "coordinate" in b ? b.coordinate : undefined;
    if (!samePoint(left, right)) return false;
  }
  if ("coordinates" in a || "coordinates" in b) {
    const left = "coordinates" in a ? a.coordinates : undefined;
    const right = "coordinates" in b ? b.coordinates : undefined;
    if (!samePath(left, right)) return false;
  }
  if (a.kind === "circle" && b.kind === "circle") {
    if (!samePoint(a.center, b.center)) return false;
    if (a.radiusMeters !== b.radiusMeters) return false;
  }
  const rotationA = "rotation" in a ? a.rotation : undefined;
  const rotationB = "rotation" in b ? b.rotation : undefined;
  return rotationA === rotationB;
}

/**
 * The same annotations, whatever order they arrive in and whatever they carry.
 * Tells a host array that is merely behind apart from a genuinely different
 * list, such as a project load.
 */
export function sameIds(a: Annotation[], b: Annotation[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const ids = new Set(b.map((annotation) => annotation.id));
  return a.every((annotation) => ids.has(annotation.id));
}

/**
 * Compares only what the map paints and edits. Two lists are the same geometry
 * when ids, kinds, and positions line up, even if the host has remapped
 * colours, labels, or its own `data` fields. Order is not geometry: a host
 * merge is free to hand the same shapes back in a different order.
 */
export function sameGeometry(a: Annotation[], b: Annotation[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((annotation) => [annotation.id, annotation]));
  return a.every((annotation) => {
    const match = byId.get(annotation.id);
    return match !== undefined && sameAnnotationGeometry(annotation, match);
  });
}
