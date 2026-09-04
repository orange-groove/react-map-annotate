import type { Annotation, AreaAnnotation, LngLat } from "../types";
import {
  boundsRing,
  circleRing,
  closeRing,
  destination,
  haversineDistance,
  openRing,
  rectangleRing,
  ringCentroid,
} from "./geo";

export function offsetLngLat(point: LngLat, from: LngLat, to: LngLat): LngLat {
  return [point[0] + (to[0] - from[0]), point[1] + (to[1] - from[1])];
}

export function moveAnnotation(
  annotation: Annotation,
  from: LngLat,
  to: LngLat,
): Annotation {
  const shift = (point: LngLat) => offsetLngLat(point, from, to);
  if (annotation.kind === "marker") {
    return { ...annotation, coordinate: shift(annotation.coordinate) };
  }
  if (annotation.kind === "circle") {
    return {
      ...annotation,
      center: annotation.center ? shift(annotation.center) : annotation.center,
      coordinates: annotation.coordinates.map(shift),
    };
  }
  if (annotation.kind === "measure" && annotation.measurement) {
    return {
      ...annotation,
      coordinates: annotation.coordinates.map(shift),
      measurement: {
        ...annotation.measurement,
        samples: annotation.measurement.samples.map((sample) => ({
          ...sample,
          coordinate: shift(sample.coordinate),
        })),
      },
    };
  }
  return {
    ...annotation,
    coordinates: annotation.coordinates.map(shift),
  };
}

export function resizeRectangleVertex(
  annotation: AreaAnnotation,
  vertexIndex: number,
  next: LngLat,
): AreaAnnotation {
  const vertices = openRing(annotation.coordinates);
  if (vertices.length < 4) return annotation;
  const opposite = vertices[(vertexIndex + 2) % vertices.length];
  if (!opposite) return annotation;
  return {
    ...annotation,
    coordinates: rectangleRing(opposite, next),
  };
}

export function movePolygonVertex(
  annotation: AreaAnnotation,
  vertexIndex: number,
  next: LngLat,
): AreaAnnotation {
  const vertices = openRing(annotation.coordinates);
  if (!vertices[vertexIndex]) return annotation;
  const nextVertices = vertices.slice();
  nextVertices[vertexIndex] = next;
  return {
    ...annotation,
    coordinates: closeRing(nextVertices),
  };
}

export function resizeCircle(
  annotation: AreaAnnotation,
  next: LngLat,
): AreaAnnotation {
  const center = annotation.center ?? ringCentroid(annotation.coordinates);
  const radiusMeters = Math.max(1, haversineDistance(center, next));
  return {
    ...annotation,
    center,
    radiusMeters,
    coordinates: circleRing(center, radiusMeters),
  };
}

export function circleResizeHandle(annotation: AreaAnnotation): LngLat | null {
  const center = annotation.center ?? ringCentroid(annotation.coordinates);
  const radiusMeters =
    annotation.radiusMeters ??
    (annotation.coordinates[0]
      ? haversineDistance(center, annotation.coordinates[0])
      : 0);
  if (radiusMeters <= 0) return null;
  return destination(center, 135, radiusMeters);
}

export function drawBoundsRing(annotation: Annotation): LngLat[] {
  if (annotation.kind !== "draw") return [];
  return boundsRing(annotation.coordinates);
}

export function editableVertices(annotation: Annotation): LngLat[] {
  if (annotation.kind === "polygon" || annotation.kind === "rectangle") {
    return openRing(annotation.coordinates);
  }
  return [];
}
