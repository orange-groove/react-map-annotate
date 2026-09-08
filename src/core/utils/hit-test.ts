import type { MapPoint } from "../types";
import type { Annotation, LngLat, TextAnnotation } from "../types";
import {
  isAreaAnnotation,
  isMarkerAnnotation,
  isPathAnnotation,
  isTextAnnotation,
  labelAnchor,
} from "./annotations";
import { drawBoundsRing, textHitSize } from "./edit";

const LINE_HIT_PX = 9;
const MARKER_HIT_HALF_W = 16;
const MARKER_HIT_H = 44;
const MARKER_PIN_WIDTH = 27;
const MARKER_PIN_HEIGHT = 40;
const MARKER_LABEL_OFFSET_Y = 56;
const PATH_LABEL_OFFSET_Y = 8;
const LABEL_NUDGE_Y = 6;
const LABEL_ESTIMATE_HEIGHT = 24;
const LABEL_CHAR_WIDTH = 7;
const LABEL_PAD_X = 16;
const LABEL_MAX_WIDTH = 220;
const LABEL_MIN_WIDTH = 40;

export function distanceToSegment(
  point: MapPoint,
  start: MapPoint,
  end: MapPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function distanceToPath(point: MapPoint, points: MapPoint[]): number {
  let min = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    min = Math.min(
      min,
      distanceToSegment(point, points[index - 1], points[index]),
    );
  }
  return min;
}

function distanceToPathAt(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  point: MapPoint,
  coordinates: LngLat[],
): number {
  let min = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = project({
      lng: coordinates[index - 1][0],
      lat: coordinates[index - 1][1],
    });
    const end = project({
      lng: coordinates[index][0],
      lat: coordinates[index][1],
    });
    min = Math.min(min, distanceToSegment(point, start, end));
  }
  return min;
}

export function pointInRing(point: MapPoint, ring: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function projectRing(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  coordinates: LngLat[],
): MapPoint[] {
  return coordinates.map((coordinate) =>
    project({ lng: coordinate[0], lat: coordinate[1] }),
  );
}

function hitMarker(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  point: MapPoint,
  coordinate: LngLat,
): boolean {
  const tip = project({ lng: coordinate[0], lat: coordinate[1] });
  const dx = Math.abs(point.x - tip.x);
  const dy = point.y - tip.y;
  return dx <= MARKER_HIT_HALF_W && dy >= -MARKER_HIT_H && dy <= MARKER_HIT_H;
}

function hitText(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  point: MapPoint,
  annotation: TextAnnotation,
): boolean {
  const origin = project({
    lng: annotation.coordinate[0],
    lat: annotation.coordinate[1],
  });
  const { width, height } = textHitSize(annotation);
  return (
    point.x >= origin.x - width / 2 &&
    point.x <= origin.x + width / 2 &&
    point.y >= origin.y - height / 2 &&
    point.y <= origin.y + height / 2
  );
}

export function hitTestAnnotations(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  point: MapPoint,
  annotations: Annotation[],
): string | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (isTextAnnotation(annotation) && hitText(project, point, annotation)) {
      return annotation.id;
    }
  }

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (
      isMarkerAnnotation(annotation) &&
      hitMarker(project, point, annotation.coordinate)
    ) {
      return annotation.id;
    }
  }

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (isPathAnnotation(annotation)) {
      if (
        distanceToPathAt(project, point, annotation.coordinates) <= LINE_HIT_PX
      ) {
        return annotation.id;
      }
    }
  }

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (isAreaAnnotation(annotation)) {
      if (pointInRing(point, projectRing(project, annotation.coordinates))) {
        return annotation.id;
      }
    }
  }

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (annotation.kind !== "draw") continue;
    const box = drawBoundsRing(annotation);
    if (box.length >= 4 && pointInRing(point, projectRing(project, box))) {
      return annotation.id;
    }
  }

  return null;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MARQUEE_MIN_PX = 4;

export function screenRectFromPoints(a: MapPoint, b: MapPoint): ScreenRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function screenRectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function boundsFromPoints(points: MapPoint[]): ScreenRect | null {
  if (points.length === 0) return null;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export function annotationScreenBounds(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  annotation: Annotation,
): ScreenRect | null {
  if (isTextAnnotation(annotation)) {
    const origin = project({
      lng: annotation.coordinate[0],
      lat: annotation.coordinate[1],
    });
    const { width, height } = textHitSize(annotation);
    return {
      x: origin.x - width / 2,
      y: origin.y - height / 2,
      width,
      height,
    };
  }
  if (isMarkerAnnotation(annotation)) {
    const tip = project({
      lng: annotation.coordinate[0],
      lat: annotation.coordinate[1],
    });
    return {
      x: tip.x - MARKER_HIT_HALF_W,
      y: tip.y - MARKER_HIT_H,
      width: MARKER_HIT_HALF_W * 2,
      height: MARKER_HIT_H * 2,
    };
  }
  const coordinates =
    annotation.kind === "draw" || annotation.kind === "trace"
      ? [...annotation.coordinates, ...drawBoundsRing(annotation)]
      : "coordinates" in annotation
        ? annotation.coordinates
        : [];
  return boundsFromPoints(
    coordinates.map((coordinate) =>
      project({ lng: coordinate[0], lat: coordinate[1] }),
    ),
  );
}

export function idsInScreenRect(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  rect: ScreenRect,
  annotations: Annotation[],
): string[] {
  if (rect.width < MARQUEE_MIN_PX && rect.height < MARQUEE_MIN_PX) return [];
  return annotations
    .filter((annotation) => {
      const bounds = annotationScreenBounds(project, annotation);
      return bounds != null && screenRectsOverlap(rect, bounds);
    })
    .map((annotation) => annotation.id);
}

export function unionScreenRects(
  rects: Array<ScreenRect | null | undefined>,
): ScreenRect | null {
  const boxes = rects.filter(
    (rect): rect is ScreenRect =>
      rect != null &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height),
  );
  if (boxes.length === 0) return null;
  let minX = boxes[0].x;
  let minY = boxes[0].y;
  let maxX = boxes[0].x + boxes[0].width;
  let maxY = boxes[0].y + boxes[0].height;
  for (const box of boxes.slice(1)) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function padScreenRect(rect: ScreenRect, pad: number): ScreenRect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function estimateLabelWidth(label: string): number {
  return Math.min(
    LABEL_MAX_WIDTH,
    Math.max(LABEL_MIN_WIDTH, label.length * LABEL_CHAR_WIDTH + LABEL_PAD_X),
  );
}

export function estimatedLabelScreenBounds(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  annotation: Annotation,
): ScreenRect | null {
  if (isTextAnnotation(annotation)) return null;
  const label = annotation.label.trim();
  if (!label) return null;
  const anchor = labelAnchor(annotation);
  if (!anchor) return null;
  const point = project({ lng: anchor[0], lat: anchor[1] });
  const width = estimateLabelWidth(label);
  if (isAreaAnnotation(annotation)) {
    return {
      x: point.x - width / 2,
      y: point.y - LABEL_ESTIMATE_HEIGHT / 2,
      width,
      height: LABEL_ESTIMATE_HEIGHT,
    };
  }
  const offsetY = isMarkerAnnotation(annotation)
    ? MARKER_LABEL_OFFSET_Y
    : PATH_LABEL_OFFSET_Y;
  return {
    x: point.x - width / 2,
    y: point.y - offsetY - LABEL_NUDGE_Y - LABEL_ESTIMATE_HEIGHT,
    width,
    height: LABEL_ESTIMATE_HEIGHT,
  };
}

export function annotationVisualScreenBounds(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  annotation: Annotation,
  includeLabels = true,
): ScreenRect | null {
  if (isTextAnnotation(annotation)) {
    return annotationScreenBounds(project, annotation);
  }
  if (isMarkerAnnotation(annotation)) {
    const tip = project({
      lng: annotation.coordinate[0],
      lat: annotation.coordinate[1],
    });
    const pin: ScreenRect = {
      x: tip.x - MARKER_PIN_WIDTH / 2,
      y: tip.y - MARKER_PIN_HEIGHT,
      width: MARKER_PIN_WIDTH,
      height: MARKER_PIN_HEIGHT,
    };
    return unionScreenRects([
      pin,
      includeLabels ? estimatedLabelScreenBounds(project, annotation) : null,
    ]);
  }
  return unionScreenRects([
    annotationScreenBounds(project, annotation),
    includeLabels ? estimatedLabelScreenBounds(project, annotation) : null,
  ]);
}

export function groupVisualScreenBounds(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  members: Annotation[],
  overlayRects: ScreenRect[] = [],
  options?: { includeLabels?: boolean },
): ScreenRect | null {
  if (members.length < 2) return null;
  const includeLabels = options?.includeLabels !== false;
  return unionScreenRects([
    ...members.map((annotation) =>
      annotationVisualScreenBounds(project, annotation, includeLabels),
    ),
    ...overlayRects,
  ]);
}

function escapeAttrSelector(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function clientRectRelativeToHost(element: Element, host: Element): ScreenRect {
  const box = element.getBoundingClientRect();
  const origin = host.getBoundingClientRect();
  return {
    x: box.left - origin.left,
    y: box.top - origin.top,
    width: box.width,
    height: box.height,
  };
}

const OVERLAY_LABEL_ATTRS = [
  "data-rma-marker",
  "data-rma-label",
  "data-rma-text",
] as const;
const OVERLAY_BODY_ATTRS = ["data-rma-marker", "data-rma-text"] as const;

export function overlayVisualRects(
  host: Element,
  ids: string[],
  includeLabels = true,
): ScreenRect[] {
  const attrs = includeLabels ? OVERLAY_LABEL_ATTRS : OVERLAY_BODY_ATTRS;
  const scopes: ParentNode[] = [host];
  if (host.parentElement) scopes.push(host.parentElement);
  const rects: ScreenRect[] = [];
  const seen = new Set<Element>();
  for (const id of ids) {
    const escaped = escapeAttrSelector(id);
    const selector = attrs.map((attr) => `[${attr}="${escaped}"]`).join(",");
    for (const scope of scopes) {
      for (const node of scope.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        const rect = clientRectRelativeToHost(node, host);
        if (rect.width > 0 && rect.height > 0) rects.push(rect);
      }
    }
  }
  return rects;
}
