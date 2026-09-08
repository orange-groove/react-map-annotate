import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  arrowHeadSize,
  isPointTool,
} from "../constants";
import type {
  Annotation,
  DraftAnnotation,
  LngLat,
  MarkerAnnotation,
  PathAnnotation,
} from "../types";
import {
  isAreaAnnotation,
  isMarkerAnnotation,
  isPathAnnotation,
  previewCoordinates,
} from "./annotations";
import { drawBoundsRing } from "./edit";
import {
  circleRing,
  haversineDistance,
  initialBearing,
  rectangleRing,
} from "./geo";

export interface ArrowMarker {
  id: string;
  coordinate: LngLat;
  bearing: number;
  direction: "start" | "end";
  color: string;
  selected: boolean;
  size: number;
}

export interface AnnotationFeatures {
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  fills: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  dashed: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  bounds: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  samples: GeoJSON.FeatureCollection<GeoJSON.Point>;
  arrows: ArrowMarker[];
  markers: MarkerAnnotation[];
}

function annotationColor(
  annotation: { style?: { color?: string } },
  fallback: string,
) {
  return annotation.style?.color ?? fallback;
}

function lineFeature(
  id: string,
  kind: string,
  coordinates: LngLat[],
  selected: boolean,
  color: string,
  strokeWidth: number,
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: { id, kind, selected, color, strokeWidth },
    geometry: { type: "LineString", coordinates },
  };
}

function polygonFeature(
  id: string,
  kind: string,
  coordinates: LngLat[],
  selected: boolean,
  color: string,
  fillOpacity: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: { id, kind, selected, color, fillOpacity },
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

export function draftPolygonPreview(draft: DraftAnnotation): {
  solid: LngLat[][];
  dashed: LngLat[][];
} {
  if (draft.kind !== "polygon") return { solid: [], dashed: [] };
  const committed = draft.coordinates;
  const first = committed[0];
  const cursor = draft.cursor;
  const solid: LngLat[][] = [];
  const dashed: LngLat[][] = [];
  if (committed.length >= 2) {
    solid.push(committed);
  }
  if (cursor && first) {
    const last = committed[committed.length - 1];
    if (last && committed.length >= 2) {
      solid.push([last, cursor]);
    }
    dashed.push([cursor, first]);
  } else if (first && committed.length >= 3) {
    dashed.push([committed[committed.length - 1], first]);
  }
  return { solid, dashed };
}

export function draftAreaCoordinates(draft: DraftAnnotation): LngLat[] {
  const coords = previewCoordinates(draft);
  if (draft.kind === "circle" && coords.length >= 2) {
    return circleRing(
      coords[0],
      Math.max(1, haversineDistance(coords[0], coords[1])),
    );
  }
  if (draft.kind === "rectangle" && coords.length >= 2) {
    return rectangleRing(coords[0], coords[1]);
  }
  if (draft.kind === "polygon" && coords.length >= 2) {
    return coords.length >= 3 ? [...coords, coords[0]] : coords;
  }
  return [];
}

function arrowsFor(
  annotation: PathAnnotation,
  color: string,
  selected: boolean,
  strokeWidth: number,
): ArrowMarker[] {
  const coords = annotation.coordinates;
  if (coords.length < 2) return [];
  const size = arrowHeadSize(strokeWidth);
  const arrows: ArrowMarker[] = [];
  if (
    annotation.kind === "arrow" ||
    annotation.kind === "bidirectional-arrow"
  ) {
    arrows.push({
      id: annotation.id,
      coordinate: coords[coords.length - 1],
      bearing: initialBearing(
        coords[coords.length - 2],
        coords[coords.length - 1],
      ),
      direction: "end",
      color,
      selected,
      size,
    });
  }
  if (annotation.kind === "bidirectional-arrow") {
    arrows.push({
      id: annotation.id,
      coordinate: coords[0],
      bearing: initialBearing(coords[1], coords[0]),
      direction: "start",
      color,
      selected,
      size,
    });
  }
  return arrows;
}

export function buildAnnotationFeatures({
  annotations,
  draft = null,
  selectedId = null,
  selectedIds,
  hoveredId = null,
  defaultColor = DEFAULT_COLOR,
  defaultStrokeWidth = DEFAULT_STROKE_WIDTH,
}: {
  annotations: Annotation[];
  draft?: DraftAnnotation | null;
  selectedId?: string | null;
  selectedIds?: string[];
  hoveredId?: string | null;
  defaultColor?: string;
  defaultStrokeWidth?: number;
}): AnnotationFeatures {
  const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const fillFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const dashedFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const boundsFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const sampleFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const arrows: ArrowMarker[] = [];
  const markers: MarkerAnnotation[] = [];

  for (const annotation of annotations) {
    const selected = selectedIds?.length
      ? selectedIds.includes(annotation.id)
      : annotation.id === selectedId;
    const color = annotationColor(annotation, defaultColor);
    if (isPathAnnotation(annotation)) {
      const strokeWidth = annotation.style?.strokeWidth ?? defaultStrokeWidth;
      lineFeatures.push(
        lineFeature(
          annotation.id,
          annotation.kind,
          annotation.coordinates,
          selected,
          color,
          strokeWidth,
        ),
      );
      arrows.push(...arrowsFor(annotation, color, selected, strokeWidth));
      if (
        (annotation.kind === "draw" || annotation.kind === "trace") &&
        !annotation.groupId &&
        (annotation.id === hoveredId || selected)
      ) {
        const box = drawBoundsRing(annotation);
        if (box.length >= 4) {
          boundsFeatures.push(
            polygonFeature(annotation.id, "bounds", box, selected, color, 0),
          );
        }
      }
      if (annotation.kind === "measure" && annotation.measurement) {
        for (const sample of annotation.measurement.samples) {
          sampleFeatures.push({
            type: "Feature",
            properties: { id: annotation.id, kind: "measure" },
            geometry: { type: "Point", coordinates: sample.coordinate },
          });
        }
      }
    } else if (isAreaAnnotation(annotation)) {
      fillFeatures.push(
        polygonFeature(
          annotation.id,
          annotation.kind,
          annotation.coordinates,
          selected,
          color,
          annotation.id === hoveredId
            ? (annotation.style?.fillOpacity ?? 0.18)
            : 0,
        ),
      );
    } else if (isMarkerAnnotation(annotation)) {
      markers.push(annotation);
    }
  }

  if (draft) {
    const coords = previewCoordinates(draft);
    if (
      draft.kind === "draw" ||
      draft.kind === "trace" ||
      draft.kind === "line" ||
      draft.kind === "arrow" ||
      draft.kind === "bidirectional-arrow" ||
      draft.kind === "measure"
    ) {
      if (coords.length >= 2) {
        lineFeatures.push(
          lineFeature(
            "draft",
            draft.kind,
            coords,
            true,
            defaultColor,
            defaultStrokeWidth,
          ),
        );
      }
    } else if (draft.kind === "polygon") {
      const area = draftAreaCoordinates(draft);
      if (area.length >= 4) {
        fillFeatures.push(
          polygonFeature("draft", draft.kind, area, true, defaultColor, 0.12),
        );
      }
      const preview = draftPolygonPreview(draft);
      for (const [index, segment] of preview.solid.entries()) {
        lineFeatures.push(
          lineFeature(
            `draft-solid-${index}`,
            draft.kind,
            segment,
            true,
            defaultColor,
            defaultStrokeWidth,
          ),
        );
      }
      for (const [index, segment] of preview.dashed.entries()) {
        dashedFeatures.push(
          lineFeature(
            `draft-close-${index}`,
            draft.kind,
            segment,
            true,
            defaultColor,
            defaultStrokeWidth,
          ),
        );
      }
    } else if (!isPointTool(draft.kind)) {
      const area = draftAreaCoordinates(draft);
      if (area.length >= 4) {
        fillFeatures.push(
          polygonFeature("draft", draft.kind, area, true, defaultColor, 0.12),
        );
      } else if (coords.length >= 2) {
        lineFeatures.push(
          lineFeature(
            "draft",
            draft.kind,
            coords,
            true,
            defaultColor,
            defaultStrokeWidth,
          ),
        );
      }
    }
  }

  return {
    lines: { type: "FeatureCollection", features: lineFeatures },
    fills: { type: "FeatureCollection", features: fillFeatures },
    dashed: { type: "FeatureCollection", features: dashedFeatures },
    bounds: { type: "FeatureCollection", features: boundsFeatures },
    samples: { type: "FeatureCollection", features: sampleFeatures },
    arrows,
    markers,
  };
}
