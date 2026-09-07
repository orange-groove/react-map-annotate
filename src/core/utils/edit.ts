import {
  DEFAULT_FONT_SIZE,
  HANDLE_HIT_PX,
  MAX_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE,
} from "../constants";
import type { MapPoint } from "../types";
import type {
  Annotation,
  AreaAnnotation,
  LngLat,
  PathAnnotation,
  TextAnnotation,
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
  kind: "vertex" | "resize" | "insert";
  index: number;
}

export type TerrainEditOptions = {
  map?: TerrainMap | null;
  sampleIntervalMeters?: number;
};

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
  if (annotation.kind === "marker" || annotation.kind === "text") {
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

export function textFontSize(annotation: Pick<Annotation, "style">): number {
  return annotation.style?.fontSize ?? DEFAULT_FONT_SIZE;
}

export function clampTextFontSize(fontSize: number): number {
  return Math.min(
    MAX_TEXT_FONT_SIZE,
    Math.max(MIN_TEXT_FONT_SIZE, Math.round(fontSize)),
  );
}

export function resizeText(
  annotation: TextAnnotation,
  fontSize: number,
): TextAnnotation {
  return {
    ...annotation,
    style: {
      ...annotation.style,
      fontSize: clampTextFontSize(fontSize),
    },
  };
}

export function textHitSize(annotation: TextAnnotation): {
  width: number;
  height: number;
} {
  const fontSize = textFontSize(annotation);
  const label = annotation.label.trim() || "Text";
  const lines = label.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return {
    width: Math.max(fontSize, longest * fontSize * 0.62) + 16,
    height: Math.max(fontSize, lines.length * fontSize * 1.25) + 12,
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
    return annotation.coordinates.length >= 2
      ? annotation.coordinates.slice()
      : [];
  }
  return [];
}

export function canInsertVertices(annotation: Annotation): boolean {
  return annotation.kind === "polygon" || hasPathEndpoints(annotation);
}

function ringVertices(annotation: Annotation): LngLat[] {
  if (annotation.kind === "polygon") return openRing(annotation.coordinates);
  if (hasPathEndpoints(annotation)) return annotation.coordinates.slice();
  return [];
}

export function insertHandlesFor(
  annotation: Annotation,
): Array<{ coordinate: LngLat } & EditHandleHit> {
  if (!canInsertVertices(annotation)) return [];
  const vertices = ringVertices(annotation);
  if (vertices.length < 2) return [];
  const closed = annotation.kind === "polygon";
  const edgeCount = closed ? vertices.length : vertices.length - 1;
  const handles: Array<{ coordinate: LngLat } & EditHandleHit> = [];
  for (let index = 0; index < edgeCount; index++) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) continue;
    handles.push({
      coordinate: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      kind: "insert",
      index,
    });
  }
  return handles;
}

function withPathCoordinates(
  annotation: PathAnnotation,
  coordinates: LngLat[],
  options: TerrainEditOptions = {},
): PathAnnotation {
  if (coordinates.length < 2) return annotation;
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

export function movePathVertex(
  annotation: PathAnnotation,
  index: number,
  next: LngLat,
  options: TerrainEditOptions = {},
): PathAnnotation {
  if (!hasPathEndpoints(annotation)) return annotation;
  if (!annotation.coordinates[index]) return annotation;
  const coordinates = annotation.coordinates.slice();
  coordinates[index] = next;
  return withPathCoordinates(annotation, coordinates, options);
}

export function insertVertex(
  annotation: Annotation,
  edgeIndex: number,
  point: LngLat,
  options: TerrainEditOptions = {},
): Annotation {
  if (annotation.kind === "polygon") {
    const vertices = openRing(annotation.coordinates);
    if (edgeIndex < 0 || edgeIndex >= vertices.length) return annotation;
    const nextVertices = vertices.slice();
    nextVertices.splice(edgeIndex + 1, 0, point);
    return { ...annotation, coordinates: closeRing(nextVertices) };
  }
  if (hasPathEndpoints(annotation)) {
    if (edgeIndex < 0 || edgeIndex >= annotation.coordinates.length - 1) {
      return annotation;
    }
    const coordinates = annotation.coordinates.slice();
    coordinates.splice(edgeIndex + 1, 0, point);
    return withPathCoordinates(annotation, coordinates, options);
  }
  return annotation;
}

export function removeVertex(
  annotation: Annotation,
  vertexIndex: number,
  options: TerrainEditOptions = {},
): Annotation {
  if (annotation.kind === "polygon") {
    const vertices = openRing(annotation.coordinates);
    if (vertices.length <= 3 || !vertices[vertexIndex]) return annotation;
    const nextVertices = vertices.slice();
    nextVertices.splice(vertexIndex, 1);
    return { ...annotation, coordinates: closeRing(nextVertices) };
  }
  if (hasPathEndpoints(annotation)) {
    if (annotation.coordinates.length <= 2) return annotation;
    if (!annotation.coordinates[vertexIndex]) return annotation;
    const coordinates = annotation.coordinates.slice();
    coordinates.splice(vertexIndex, 1);
    return withPathCoordinates(annotation, coordinates, options);
  }
  return annotation;
}

export function canRemoveVertex(
  annotation: Annotation,
  vertexIndex: number,
): boolean {
  return removeVertex(annotation, vertexIndex) !== annotation;
}

export function movePathEndpoint(
  annotation: PathAnnotation,
  end: PathEndpoint,
  next: LngLat,
  options: TerrainEditOptions = {},
): PathAnnotation {
  const index = end === "start" ? 0 : annotation.coordinates.length - 1;
  return movePathVertex(annotation, index, next, options);
}

export function editHandlesFor(
  annotation: Annotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): Array<{ coordinate: LngLat } & EditHandleHit> {
  if (annotation.kind === "circle") {
    const coordinate = circleResizeHandle(annotation, project);
    return coordinate ? [{ coordinate, kind: "resize", index: 0 }] : [];
  }
  return [
    ...editableVertices(annotation).map((coordinate, index) => ({
      coordinate,
      kind: "vertex" as const,
      index,
    })),
    ...insertHandlesFor(annotation),
  ];
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
  if (handle.kind === "insert") {
    return insertVertex(annotation, handle.index, next, options);
  }
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
    return movePathVertex(annotation, handle.index, next, options);
  }
  return annotation;
}

export function editHandleCursor(handle: EditHandleHit): string {
  if (handle.kind === "resize") return "nwse-resize";
  if (handle.kind === "insert") return "pointer";
  return "move";
}
