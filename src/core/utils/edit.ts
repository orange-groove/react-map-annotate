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
  Measurement,
  PathAnnotation,
  TextAnnotation,
} from "../types";
import {
  bearingDelta,
  boundsRing,
  circleRing,
  closeRing,
  destination,
  formatDistance,
  haversineDistance,
  initialBearing,
  openRing,
  pathLength,
  rectangleRing,
  ringCentroid,
  rotateLngLat,
} from "./geo";
import {
  formatMeasurement,
  measurePath,
  queryGroundElevation,
  type TerrainMap,
} from "./measure";

export type PathEndpoint = "start" | "end";

export interface EditHandleHit {
  kind: "vertex" | "resize" | "insert" | "rotate";
  index: number;
}

// Far enough past the corner that the rotate handle does not cover the corner
// handle sitting there. Every handle grabs within `HANDLE_HIT_PX` of itself, so
// on the diagonal of a corner the two only clear each other beyond
// `HANDLE_HIT_PX * Math.SQRT2`.
const ROTATE_HANDLE_OFFSET_PX = HANDLE_HIT_PX * 2;
const ROTATE_HANDLE_OFFSET_M = 32;

export type TerrainEditOptions = {
  map?: TerrainMap | null;
  sampleIntervalMeters?: number;
  /**
   * Skip re-sampling a measure path. Sampling walks the line every 10 m and
   * queries terrain at each sample, which is far too much for one frame of a
   * drag. The map layer settles it once when the gesture commits.
   */
  preview?: boolean;
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

/**
 * Distance without elevation, cheap enough to run every frame. A drag keeps
 * the readout live and drops the sample dots until the gesture commits.
 */
export function previewMeasurement(coordinates: LngLat[]): Measurement {
  return {
    distanceMeters: pathLength(coordinates),
    samples: [],
    elevationGainMeters: 0,
    elevationLossMeters: 0,
    minElevationMeters: null,
    maxElevationMeters: null,
  };
}

export function moveAnnotation(
  annotation: Annotation,
  from: LngLat,
  to: LngLat,
  options: { preview?: boolean } = {},
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
    const coordinates = annotation.coordinates.map(shift);
    // A translation cannot change the distance, so only the samples move.
    // Skip them mid-drag; a long path carries hundreds.
    if (options.preview) {
      return {
        ...annotation,
        coordinates,
        measurement: { ...annotation.measurement, samples: [] },
      };
    }
    return {
      ...annotation,
      coordinates,
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

export function textRotation(annotation: Pick<TextAnnotation, "rotation">) {
  return annotation.rotation ?? 0;
}

export function wrapRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function rotateScreenOffset(
  offset: MapPoint,
  rotationDeg: number,
): MapPoint {
  if (!rotationDeg) return offset;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}

export function resizeRectangleVertex(
  annotation: AreaAnnotation,
  vertexIndex: number,
  next: LngLat,
): AreaAnnotation {
  const vertices = openRing(annotation.coordinates);
  if (vertices.length < 4) return annotation;
  const count = vertices.length;
  const index = ((vertexIndex % count) + count) % count;
  const opposite = vertices[(index + 2) % count];
  const adjA = vertices[(index + 1) % count];
  const adjB = vertices[(index + 3) % count];
  if (!opposite || !adjA || !adjB) return annotation;

  const ux = adjA[0] - opposite[0];
  const uy = adjA[1] - opposite[1];
  const vx = adjB[0] - opposite[0];
  const vy = adjB[1] - opposite[1];
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-18) {
    return {
      ...annotation,
      coordinates: rectangleRing(opposite, next),
    };
  }

  const dx = next[0] - opposite[0];
  const dy = next[1] - opposite[1];
  const su = (dx * vy - dy * vx) / det;
  const sv = (ux * dy - uy * dx) / det;
  const newAdjA: LngLat = [opposite[0] + su * ux, opposite[1] + su * uy];
  const newAdjB: LngLat = [opposite[0] + sv * vx, opposite[1] + sv * vy];
  const newVertex: LngLat = [
    opposite[0] + su * ux + sv * vx,
    opposite[1] + su * uy + sv * vy,
  ];
  if (
    haversineDistance(opposite, newAdjA) < 1 ||
    haversineDistance(opposite, newAdjB) < 1
  ) {
    return annotation;
  }

  const nextVertices = vertices.slice();
  nextVertices[index] = newVertex;
  nextVertices[(index + 1) % count] = newAdjA;
  nextVertices[(index + 2) % count] = opposite;
  nextVertices[(index + 3) % count] = newAdjB;
  return {
    ...annotation,
    coordinates: closeRing(nextVertices),
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

function orientedBoundsRing(coordinates: LngLat[], rotation = 0): LngLat[] {
  if (!rotation) return boundsRing(coordinates);
  const center = ringCentroid(coordinates);
  const local = coordinates.map((point) =>
    rotateLngLat(point, center, -rotation),
  );
  return boundsRing(local).map((point) =>
    rotateLngLat(point, center, rotation),
  );
}

export function drawBoundsRing(annotation: Annotation): LngLat[] {
  if (annotation.kind !== "draw" && annotation.kind !== "trace") return [];
  const rotation = annotation.kind === "draw" ? (annotation.rotation ?? 0) : 0;
  return orientedBoundsRing(annotation.coordinates, rotation);
}

export function drawResizeHandle(annotation: Annotation): LngLat | null {
  if (annotation.kind !== "draw") return null;
  const box = drawBoundsRing(annotation);
  return box[1] ?? null;
}

export function resizeDraw(
  annotation: PathAnnotation,
  next: LngLat,
  grab?: { from: LngLat; handle: LngLat },
): PathAnnotation {
  if (annotation.kind !== "draw") return annotation;
  const box = drawBoundsRing(annotation);
  const handle = box[1];
  const opposite = box[3];
  const center = ringCentroid(annotation.coordinates);
  if (!handle || !opposite) return annotation;
  const target = grab ? offsetLngLat(grab.handle, grab.from, next) : next;
  const rotation = annotation.rotation ?? 0;
  const toLocal = (point: LngLat) => rotateLngLat(point, center, -rotation);
  const toWorld = (point: LngLat) => rotateLngLat(point, center, rotation);
  const localOpposite = toLocal(opposite);
  const localHandle = toLocal(handle);
  const localTarget = toLocal(target);
  const dx0 = localHandle[0] - localOpposite[0];
  const dy0 = localHandle[1] - localOpposite[1];
  if (Math.abs(dx0) < 1e-12 || Math.abs(dy0) < 1e-12) return annotation;
  const sx = (localTarget[0] - localOpposite[0]) / dx0;
  const sy = (localTarget[1] - localOpposite[1]) / dy0;
  if (Math.abs(sx) < 0.05 || Math.abs(sy) < 0.05) return annotation;
  return {
    ...annotation,
    coordinates: annotation.coordinates.map((point) => {
      const local = toLocal(point);
      return toWorld([
        localOpposite[0] + (local[0] - localOpposite[0]) * sx,
        localOpposite[1] + (local[1] - localOpposite[1]) * sy,
      ]);
    }),
  };
}

export function canRotateAnnotation(annotation: Annotation): boolean {
  return (
    annotation.kind === "draw" ||
    annotation.kind === "rectangle" ||
    annotation.kind === "polygon" ||
    annotation.kind === "text"
  );
}

export function rotationCenter(annotation: Annotation): LngLat | null {
  if (annotation.kind === "marker" || annotation.kind === "text") {
    return annotation.coordinate;
  }
  if (annotation.kind === "circle") {
    return annotation.center ?? ringCentroid(annotation.coordinates);
  }
  if (!("coordinates" in annotation) || annotation.coordinates.length === 0) {
    return null;
  }
  return ringCentroid(annotation.coordinates);
}

export function rotateAnnotation(
  annotation: Annotation,
  center: LngLat,
  deltaDeg: number,
): Annotation {
  if (deltaDeg === 0) return annotation;
  const rotate = (point: LngLat) => rotateLngLat(point, center, deltaDeg);
  if (annotation.kind === "text") {
    return {
      ...annotation,
      rotation: wrapRotation(textRotation(annotation) + deltaDeg),
    };
  }
  if (annotation.kind === "marker") {
    return { ...annotation, coordinate: rotate(annotation.coordinate) };
  }
  if (annotation.kind === "circle") {
    return {
      ...annotation,
      center: annotation.center ? rotate(annotation.center) : annotation.center,
      coordinates: annotation.coordinates.map(rotate),
    };
  }
  if (annotation.kind === "measure" && annotation.measurement) {
    return {
      ...annotation,
      coordinates: annotation.coordinates.map(rotate),
      measurement: {
        ...annotation.measurement,
        samples: annotation.measurement.samples.map((sample) => ({
          ...sample,
          coordinate: rotate(sample.coordinate),
        })),
      },
    };
  }
  if (!("coordinates" in annotation)) return annotation;
  if (annotation.kind === "draw" || annotation.kind === "polygon") {
    return {
      ...annotation,
      coordinates: annotation.coordinates.map(rotate),
      rotation: wrapRotation((annotation.rotation ?? 0) + deltaDeg),
    };
  }
  return {
    ...annotation,
    coordinates: annotation.coordinates.map(rotate),
  };
}

function metersPerPixel(
  center: LngLat,
  project: (lngLat: { lng: number; lat: number }) => MapPoint,
): number {
  const probe = destination(center, 0, 20);
  const origin = project({ lng: center[0], lat: center[1] });
  const edge = project({ lng: probe[0], lat: probe[1] });
  const pixels = Math.hypot(edge.x - origin.x, edge.y - origin.y);
  return pixels > 1 ? 20 / pixels : 1;
}

function topRightCorner(
  annotation: Annotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): LngLat | null {
  if (annotation.kind === "rectangle") {
    const vertices = openRing(annotation.coordinates);
    return vertices[2] ?? null;
  }
  if (annotation.kind === "draw") {
    const box = drawBoundsRing(annotation);
    return box[2] ?? null;
  }
  if (annotation.kind === "polygon") {
    const box = orientedBoundsRing(
      annotation.coordinates,
      annotation.rotation ?? 0,
    );
    return box[2] ?? null;
  }
  if (annotation.kind === "text") {
    return textTopRightCorner(annotation, project);
  }
  return null;
}

function textTopRightCorner(
  annotation: TextAnnotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): LngLat {
  const center = annotation.coordinate;
  const { width, height } = textHitSize(annotation);
  const corner = rotateScreenOffset(
    { x: width / 2, y: -height / 2 },
    textRotation(annotation),
  );
  const pixels = Math.hypot(corner.x, corner.y);
  const bearing = (Math.atan2(corner.x, -corner.y) * 180) / Math.PI;
  const meters = project
    ? pixels * metersPerPixel(center, project)
    : ROTATE_HANDLE_OFFSET_M;
  return destination(center, bearing, Math.max(meters, 1e-3));
}

export function rotateHandleFor(
  annotation: Annotation,
  project?: (lngLat: { lng: number; lat: number }) => MapPoint,
): LngLat | null {
  if (!canRotateAnnotation(annotation)) return null;
  const center = rotationCenter(annotation);
  if (!center) return null;
  const anchor = topRightCorner(annotation, project);
  if (!anchor) return null;
  const distance = haversineDistance(center, anchor);
  const bearing = distance > 0 ? initialBearing(center, anchor) : 0;
  const offset = project
    ? ROTATE_HANDLE_OFFSET_PX * metersPerPixel(center, project)
    : ROTATE_HANDLE_OFFSET_M;
  return destination(center, bearing, distance + offset);
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

  if (annotation.kind === "measure" && options.preview) {
    return {
      ...annotation,
      coordinates,
      measurement: previewMeasurement(coordinates),
      caption: formatDistance(pathLength(coordinates)),
    };
  }
  if (annotation.kind === "measure") {
    const measurement = measurePath(
      coordinates,
      (coordinate) => queryGroundElevation(options.map, coordinate),
      options.sampleIntervalMeters,
    );
    return {
      ...annotation,
      coordinates,
      measurement,
      caption: formatMeasurement(measurement),
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
  const handles: Array<{ coordinate: LngLat } & EditHandleHit> = [
    ...editableVertices(annotation).map((coordinate, index) => ({
      coordinate,
      kind: "vertex" as const,
      index,
    })),
    ...insertHandlesFor(annotation),
  ];
  const drawResize = drawResizeHandle(annotation);
  if (drawResize) {
    handles.push({ coordinate: drawResize, kind: "resize", index: 0 });
  }
  const rotate = rotateHandleFor(annotation, project);
  if (rotate) {
    handles.push({ coordinate: rotate, kind: "rotate", index: 0 });
  }
  return handles;
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
  options: TerrainEditOptions & {
    from?: LngLat;
    handleAt?: LngLat;
  } = {},
): Annotation {
  if (handle.kind === "insert") {
    return insertVertex(annotation, handle.index, next, options);
  }
  if (handle.kind === "rotate") {
    const center = rotationCenter(annotation);
    const from =
      options.from ?? options.handleAt ?? rotateHandleFor(annotation);
    if (!center || !from) return annotation;
    if (
      haversineDistance(center, from) < 1e-4 ||
      haversineDistance(center, next) < 1e-4
    ) {
      return annotation;
    }
    const delta = bearingDelta(
      initialBearing(center, from),
      initialBearing(center, next),
    );
    return rotateAnnotation(annotation, center, delta);
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
  if (annotation.kind === "draw" && handle.kind === "resize") {
    return resizeDraw(
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

export function editHandleCursor(
  handle: EditHandleHit,
  dragging = false,
): string {
  if (handle.kind === "resize") return "nwse-resize";
  if (handle.kind === "insert") return "pointer";
  if (handle.kind === "rotate") return dragging ? "grabbing" : "grab";
  return "move";
}
