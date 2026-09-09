"use client";

import { Polygon, Polyline } from "react-leaflet";
import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_OPACITY,
  DEFAULT_STROKE_WIDTH,
} from "../../core/constants";
import type { AnnotateProps, LngLat } from "../../core/types";
import { useAnnotationFeatures } from "../../paint/use-annotation-features";
import { AnnotateChrome } from "../../paint/chrome";
import { toLatLngs } from "./path";

export function LeafletAnnotateLayers({
  annotations = [],
  draft,
  selectedId,
  selectedIds,
  hoveredId = null,
  defaultColor,
  defaultStrokeWidth,
  labelsEditable = true,
  showLabels = true,
  showArea = true,
  renderArrowHead,
  renderLabel,
  onSelect,
  onLabelChange,
  onUpdate,
  onHandleDragEnd,
  tracePreview = null,
}: Pick<
  AnnotateProps,
  | "annotations"
  | "draft"
  | "selectedId"
  | "selectedIds"
  | "defaultColor"
  | "defaultStrokeWidth"
  | "labelsEditable"
  | "showLabels"
  | "showArea"
  | "renderArrowHead"
  | "renderLabel"
  | "onSelect"
  | "onLabelChange"
  | "onUpdate"
> & {
  hoveredId?: string | null;
  tracePreview?: LngLat[] | null;
  onHandleDragEnd?: (id: string) => void;
}) {
  const color = defaultColor ?? DEFAULT_COLOR;
  const strokeWidth = defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const { lines, fills, dashed, bounds, arrows, markers } =
    useAnnotationFeatures({
      annotations,
      draft,
      selectedId,
      selectedIds,
      hoveredId,
      defaultColor: color,
      defaultStrokeWidth: strokeWidth,
    });
  return (
    <>
      {fills.features.map((feature, index) => {
        const featureColor = String(feature.properties?.color ?? color);
        const skipOutline =
          feature.properties?.id === "draft" &&
          feature.properties?.kind === "polygon";
        return (
          <Polygon
            key={`fill-${index}`}
            positions={toLatLngs(feature.geometry.coordinates[0] as LngLat[])}
            interactive={false}
            pathOptions={{
              color: featureColor,
              fillColor: featureColor,
              fillOpacity: Number(feature.properties?.fillOpacity ?? 0),
              weight: skipOutline
                ? 0
                : Number(feature.properties?.strokeWidth ?? strokeWidth),
              opacity: skipOutline
                ? 0
                : Number(
                    feature.properties?.strokeOpacity ?? DEFAULT_STROKE_OPACITY,
                  ),
            }}
          />
        );
      })}

      {tracePreview && tracePreview.length >= 2 ? (
        <Polyline
          positions={toLatLngs(tracePreview)}
          interactive={false}
          pathOptions={{
            color,
            weight: strokeWidth + 8,
            opacity: 0.22,
          }}
        />
      ) : null}
      {tracePreview && tracePreview.length >= 2 ? (
        <Polyline
          positions={toLatLngs(tracePreview)}
          interactive={false}
          pathOptions={{
            color,
            weight: strokeWidth + 2,
            opacity: 0.95,
          }}
        />
      ) : null}
      {lines.features.map((feature, index) => (
        <Polyline
          key={`line-${index}`}
          positions={toLatLngs(feature.geometry.coordinates as LngLat[])}
          interactive={false}
          pathOptions={{
            color: String(feature.properties?.color ?? color),
            weight: Number(feature.properties?.strokeWidth ?? strokeWidth),
            opacity: Number(
              feature.properties?.strokeOpacity ?? DEFAULT_STROKE_OPACITY,
            ),
          }}
        />
      ))}

      {dashed.features.map((feature, index) => {
        const featureColor = String(feature.properties?.color ?? color);
        return (
          <Polyline
            key={`dash-${index}`}
            positions={toLatLngs(feature.geometry.coordinates as LngLat[])}
            interactive={false}
            pathOptions={{
              color: featureColor,
              weight: Number(feature.properties?.strokeWidth ?? strokeWidth),
              opacity: 0.9,
              dashArray: "4 10",
            }}
          />
        );
      })}

      {bounds.features.map((feature, index) => {
        const featureColor = String(feature.properties?.color ?? color);
        return (
          <Polyline
            key={`bounds-${index}`}
            positions={toLatLngs(feature.geometry.coordinates[0] as LngLat[])}
            interactive={false}
            pathOptions={{
              color: featureColor,
              weight: 1.25,
              opacity: 0.85,
              dashArray: "6 6",
            }}
          />
        );
      })}

      <AnnotateChrome
        annotations={annotations}
        draft={draft}
        selectedId={selectedId}
        selectedIds={selectedIds}
        hoveredId={hoveredId}
        color={color}
        labelsEditable={labelsEditable}
        showLabels={showLabels}
        showArea={showArea}
        renderArrowHead={renderArrowHead}
        renderLabel={renderLabel}
        arrows={arrows}
        markers={markers}
        onSelect={onSelect}
        onLabelChange={onLabelChange}
        onUpdate={onUpdate}
        onHandleDragEnd={onHandleDragEnd}
      />
    </>
  );
}
