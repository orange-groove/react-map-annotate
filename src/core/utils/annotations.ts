import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LABELS,
  SAMPLE_INTERVAL_METERS,
  clampStrokeWidth,
} from "../constants";
import type {
  Annotation,
  AnnotationKind,
  AnnotationStyle,
  AnnotateTool,
  AreaAnnotation,
  DraftAnnotation,
  LngLat,
  MarkerAnnotation,
  PathAnnotation,
  TextAnnotation,
} from "../types";
import {
  circleRing,
  closeRing,
  haversineDistance,
  pathMidpoint,
  rectangleRing,
  ringArea,
  ringCentroid,
} from "./geo";
import { createAnnotationId } from "./ids";
import {
  formatMeasurement,
  measurePath,
  queryGroundElevation,
  type TerrainMap,
} from "./measure";

export function isPathAnnotation(
  annotation: Annotation,
): annotation is PathAnnotation {
  return (
    annotation.kind === "draw" ||
    annotation.kind === "trace" ||
    annotation.kind === "line" ||
    annotation.kind === "arrow" ||
    annotation.kind === "bidirectional-arrow" ||
    annotation.kind === "measure"
  );
}

export function isArrowAnnotation(
  annotation: Annotation,
): annotation is PathAnnotation {
  return (
    annotation.kind === "arrow" || annotation.kind === "bidirectional-arrow"
  );
}

export function isAreaAnnotation(
  annotation: Annotation,
): annotation is AreaAnnotation {
  return (
    annotation.kind === "polygon" ||
    annotation.kind === "rectangle" ||
    annotation.kind === "circle"
  );
}

export function annotationAreaMeters(annotation: Annotation): number | null {
  if (!isAreaAnnotation(annotation)) return null;
  if (
    annotation.kind === "circle" &&
    annotation.radiusMeters &&
    annotation.radiusMeters > 0
  ) {
    return Math.PI * annotation.radiusMeters * annotation.radiusMeters;
  }
  const area = ringArea(annotation.coordinates);
  return area > 0 ? area : null;
}

export function isMarkerAnnotation(
  annotation: Annotation,
): annotation is MarkerAnnotation {
  return annotation.kind === "marker";
}

export function isTextAnnotation(
  annotation: Annotation,
): annotation is TextAnnotation {
  return annotation.kind === "text";
}

export function previewCoordinates(draft: DraftAnnotation | null): LngLat[] {
  if (!draft) return [];
  if (!draft.cursor) return draft.coordinates;
  return [...draft.coordinates, draft.cursor];
}

export function committedDraftCoordinates(draft: DraftAnnotation): LngLat[] {
  if (draft.cursor && draft.coordinates.length === 0) return [draft.cursor];
  if (
    draft.cursor &&
    (draft.coordinates.length === 0 ||
      haversineDistance(
        draft.coordinates[draft.coordinates.length - 1],
        draft.cursor,
      ) > 1)
  ) {
    return [...draft.coordinates, draft.cursor];
  }
  return draft.coordinates;
}

export function labelAnchor(annotation: Annotation): LngLat | null {
  if (annotation.kind === "marker" || annotation.kind === "text") {
    return annotation.coordinate;
  }
  if (annotation.kind === "circle" && annotation.center) {
    return annotation.center;
  }
  if (isAreaAnnotation(annotation)) {
    return annotation.coordinates.length
      ? ringCentroid(annotation.coordinates)
      : null;
  }
  return annotation.coordinates.length
    ? pathMidpoint(annotation.coordinates)
    : null;
}

export function setAnnotationLabel(
  annotation: Annotation,
  label: string,
): Annotation {
  return { ...annotation, label };
}

export function updateAnnotationLabel(
  annotations: Annotation[],
  id: string,
  label: string,
): Annotation[] {
  return annotations.map((annotation) =>
    annotation.id === id ? setAnnotationLabel(annotation, label) : annotation,
  );
}

export function setAnnotationStyle(
  annotation: Annotation,
  style: AnnotationStyle,
): Annotation {
  const next = { ...annotation.style, ...style };
  if (style.strokeWidth != null) {
    next.strokeWidth = clampStrokeWidth(style.strokeWidth);
  }
  return { ...annotation, style: next };
}

export function setAnnotationColor(
  annotation: Annotation,
  color: string,
): Annotation {
  return setAnnotationStyle(annotation, { color });
}

export function updateAnnotationColor(
  annotations: Annotation[],
  id: string,
  color: string,
): Annotation[] {
  return annotations.map((annotation) =>
    annotation.id === id ? setAnnotationColor(annotation, color) : annotation,
  );
}

export function cssColorForInput(
  color: string | undefined,
  fallback: string,
): string {
  if (!color) return fallback;
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return fallback;
}

export function upsertAnnotation(
  annotations: Annotation[],
  next: Annotation,
): Annotation[] {
  const index = annotations.findIndex(
    (annotation) => annotation.id === next.id,
  );
  if (index === -1) return [...annotations, next];
  return annotations.map((annotation) =>
    annotation.id === next.id ? next : annotation,
  );
}

export function removeAnnotation(
  annotations: Annotation[],
  id: string,
): Annotation[] {
  return annotations.filter((annotation) => annotation.id !== id);
}

export function upsertAnnotations(
  annotations: Annotation[],
  next: Annotation[],
): Annotation[] {
  return next.reduce(upsertAnnotation, annotations);
}

export function removeAnnotations(
  annotations: Annotation[],
  ids: string[],
): Annotation[] {
  const drop = new Set(ids);
  return annotations.filter((annotation) => !drop.has(annotation.id));
}

function pathKind(kind: AnnotationKind): kind is PathAnnotation["kind"] {
  return (
    kind === "draw" ||
    kind === "trace" ||
    kind === "line" ||
    kind === "arrow" ||
    kind === "bidirectional-arrow" ||
    kind === "measure"
  );
}

export function annotationFromDraft(
  draft: DraftAnnotation,
  options: {
    id?: string;
    map?: TerrainMap | null;
    sampleIntervalMeters?: number;
    color?: string;
    fontFamily?: string;
  } = {},
): Annotation | null {
  const coordinates = previewCoordinates(draft);
  const interval = options.sampleIntervalMeters ?? SAMPLE_INTERVAL_METERS;
  const style = options.color ? { color: options.color } : undefined;

  if (draft.kind === "marker" || draft.kind === "text") {
    const coordinate = coordinates[0];
    if (!coordinate) return null;
    if (draft.kind === "text") {
      const text: TextAnnotation = {
        id: options.id ?? createAnnotationId(),
        kind: "text",
        label: DEFAULT_LABELS.text,
        coordinate,
        style: {
          ...(style ?? {}),
          fontSize: DEFAULT_FONT_SIZE,
          ...(options.fontFamily ? { fontFamily: options.fontFamily } : {}),
        },
      };
      return text;
    }
    const marker: MarkerAnnotation = {
      id: options.id ?? createAnnotationId(),
      kind: "marker",
      label: DEFAULT_LABELS.marker,
      coordinate,
      style,
    };
    return marker;
  }

  if (draft.kind === "circle") {
    if (coordinates.length < 2) return null;
    const center = coordinates[0];
    const radiusMeters = haversineDistance(center, coordinates[1]);
    if (radiusMeters < 1) return null;
    const area: AreaAnnotation = {
      id: options.id ?? createAnnotationId(),
      kind: "circle",
      label: DEFAULT_LABELS.circle,
      coordinates: circleRing(center, radiusMeters),
      center,
      radiusMeters,
      style,
    };
    return area;
  }

  if (draft.kind === "rectangle") {
    if (coordinates.length < 2) return null;
    if (haversineDistance(coordinates[0], coordinates[1]) < 1) return null;
    const area: AreaAnnotation = {
      id: options.id ?? createAnnotationId(),
      kind: "rectangle",
      label: DEFAULT_LABELS.rectangle,
      coordinates: rectangleRing(coordinates[0], coordinates[1]),
      style,
    };
    return area;
  }

  if (draft.kind === "polygon") {
    const ring = committedDraftCoordinates(draft);
    if (ring.length < 3) return null;
    const area: AreaAnnotation = {
      id: options.id ?? createAnnotationId(),
      kind: "polygon",
      label: DEFAULT_LABELS.polygon,
      coordinates: closeRing(ring),
      style,
    };
    return area;
  }

  if (pathKind(draft.kind)) {
    const path =
      draft.kind === "draw"
        ? coordinates
        : draft.coordinates.length >= 2
          ? draft.coordinates
          : coordinates;
    if (path.length < 2) return null;
    if (pathLengthTooShort(path)) return null;

    const annotation: PathAnnotation = {
      id: options.id ?? createAnnotationId(),
      kind: draft.kind,
      label: DEFAULT_LABELS[draft.kind],
      coordinates: path,
      style,
    };

    if (draft.kind === "measure") {
      const measurement = measurePath(
        path,
        (coordinate) => queryGroundElevation(options.map, coordinate),
        interval,
      );
      annotation.measurement = measurement;
      annotation.label = formatMeasurement(measurement);
    }

    return annotation;
  }

  return null;
}

function pathLengthTooShort(coordinates: LngLat[]): boolean {
  return (
    haversineDistance(coordinates[0], coordinates[coordinates.length - 1]) <
      1 && coordinates.length === 2
  );
}

export function minVerticesForKind(kind: AnnotationKind): number {
  if (kind === "marker" || kind === "text") return 1;
  if (kind === "polygon") return 3;
  return 2;
}

export function canFinishDraft(draft: DraftAnnotation | null): boolean {
  if (!draft) return false;
  const coords = committedDraftCoordinates(draft);
  if (draft.kind === "marker" || draft.kind === "text") {
    return coords.length >= 1;
  }
  if (draft.kind === "polygon") return coords.length >= 3;
  if (draft.kind === "draw") {
    return previewCoordinates(draft).length >= 2;
  }
  return coords.length >= 2;
}

export function canPressFinish(
  tool: AnnotateTool | undefined,
  draft: DraftAnnotation | null,
): boolean {
  return (
    canFinishDraft(draft) ||
    (tool != null && tool !== "pan")
  );
}
