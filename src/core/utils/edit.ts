import { HANDLE_HIT_PX } from "../constants";
import type { MapPoint } from "../types";
import type {
  Annotation,
  AreaAnnotation,
  LngLat,
  PathAnnotation,
} from "../types";
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
import {
  formatMeasurement,
  measurePath,
  queryGroundElevation,
  type TerrainMap,
} from "./measure";

export type PathEndpoint = "start" | "end";

export interface EditHandleHit {
  kind: "vertex" | "resize";
  index: number;
}

const PATH_ENDPOINT_KINDS = new Set<PathAnnotation["kind"]>([
  "line",
  "arrow",
  "bidirectional-arrow",
  "measure",
]);

function hasPathEndpoints(
  annotation: Annotation,
): annotation is PathAnnotation {
  return PATH_ENDPOINT_KINDS.has(annotation.kind as PathAnnotation["kind"]);
}

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
  grab?: { from: LngLat; handle: LngLat },
): AreaAnnotation {
  const center = annotation.center ?? ringCentroid(annotation.coordinates);
  const target = grab ? offsetLngLat(grab.handle, grab.from, next) : next;
  const radiusMeters = Math.max(1, haversineDistance(center, target));
  return {
    ...annotation,
    center,
    radiusMeters,
    coordinates: circleRing(center, radiusMeters),
  };
}

export function circleResizeHandle(
  annotation: AreaAnnotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): LngLat | null {
  const center = annotation.center ?? ringCentroid(annotation.coordinates);
  const radiusMeters =
    annotation.radiusMeters ??
    (annotation.coordinates[0]
      ? haversineDistance(center, annotation.coordinates[0])
      : 0);
  if (radiusMeters <= 0) return null;
  const ring =
    annotation.coordinates.length >= 4
      ? annotation.coordinates
      : circleRing(center, radiusMeters);
  if (project) {
    const origin = project({ lng: center[0], lat: center[1] });
    let best: LngLat | null = null;
    let bestScore = -Infinity;
    for (const coordinate of ring) {
      const screen = project({ lng: coordinate[0], lat: coordinate[1] });
      const score = screen.x - origin.x + (screen.y - origin.y);
      if (score > bestScore) {
        bestScore = score;
        best = coordinate;
      }
    }
    if (best) return best;
  }
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
  if (hasPathEndpoints(annotation)) {
    const coordinates = annotation.coordinates;
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];
    if (!start || !end || coordinates.length < 2) return [];
    return [start, end];
  }
  return [];
}

export function movePathEndpoint(
  annotation: PathAnnotation,
  end: PathEndpoint,
  next: LngLat,
  options: {
    map?: TerrainMap | null;
    sampleIntervalMeters?: number;
  } = {},
): PathAnnotation {
  if (!hasPathEndpoints(annotation)) return annotation;
  const coordinates = annotation.coordinates.slice();
  if (coordinates.length < 2) return annotation;
  coordinates[end === "start" ? 0 : coordinates.length - 1] = next;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (
    !first ||
    !last ||
    (coordinates.length === 2 && haversineDistance(first, last) < 1)
  ) {
    return annotation;
  }

  if (annotation.kind === "measure") {
    const measurement = measurePath(
      coordinates,
      (coordinate) => queryGroundElevation(options.map, coordinate),
      options.sampleIntervalMeters,
    );
    const previousLabel = annotation.measurement
      ? formatMeasurement(annotation.measurement)
      : annotation.label;
    return {
      ...annotation,
      coordinates,
      measurement,
      label:
        annotation.label === previousLabel
          ? formatMeasurement(measurement)
          : annotation.label,
    };
  }

  return { ...annotation, coordinates };
}

export function editHandlesFor(
  annotation: Annotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): Array<{ coordinate: LngLat } & EditHandleHit> {
  if (annotation.kind === "circle") {
    const coordinate = circleResizeHandle(annotation, project);
    return coordinate ? [{ coordinate, kind: "resize", index: 0 }] : [];
  }
  return editableVertices(annotation).map((coordinate, index) => ({
    coordinate,
    kind: "vertex" as const,
    index,
  }));
}

export function hitEditHandle(
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
  point: MapPoint,
  annotation: Annotation,
  radiusPx = HANDLE_HIT_PX,
): EditHandleHit | null {
  let best: EditHandleHit | null = null;
  let bestDistance = radiusPx;
  for (const handle of editHandlesFor(annotation, project)) {
    const screen = project({
      lng: handle.coordinate[0],
      lat: handle.coordinate[1],
    });
    const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = { kind: handle.kind, index: handle.index };
    }
  }
  return best;
}

export function applyEditHandle(
  annotation: Annotation,
  handle: EditHandleHit,
  next: LngLat,
  options: {
    map?: TerrainMap | null;
    sampleIntervalMeters?: number;
    from?: LngLat;
    handleAt?: LngLat;
  } = {},
): Annotation {
  if (annotation.kind === "circle") {
    return resizeCircle(
      annotation,
      next,
      options.from && options.handleAt
        ? { from: options.from, handle: options.handleAt }
        : undefined,
    );
  }
  if (annotation.kind === "rectangle") {
    return resizeRectangleVertex(annotation, handle.index, next);
  }
  if (annotation.kind === "polygon") {
    return movePolygonVertex(annotation, handle.index, next);
  }
  if (hasPathEndpoints(annotation)) {
    return movePathEndpoint(
      annotation,
      handle.index === 0 ? "start" : "end",
      next,
      options,
    );
  }
  return annotation;
}

export function editHandleCursor(handle: EditHandleHit): string {
  return handle.kind === "resize" ? "nwse-resize" : "move";
}
