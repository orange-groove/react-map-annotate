import type { MapPoint } from "../types";
import type { Annotation, LngLat, TextAnnotation } from "../types";
import {
  isAreaAnnotation,
  isMarkerAnnotation,
  isPathAnnotation,
  isTextAnnotation,
} from "./annotations";
import { drawBoundsRing, textHitSize } from "./edit";

const LINE_HIT_PX = 9;
const MARKER_HIT_HALF_W = 16;
const MARKER_HIT_H = 44;

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
  const dy = tip.y - point.y;
  return dx <= MARKER_HIT_HALF_W && dy >= -4 && dy <= MARKER_HIT_H;
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
