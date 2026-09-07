"use client";

import { Polygon, Polyline } from "react-leaflet";
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from "../../core/constants";
import type { AnnotateProps, LngLat } from "../../core/types";
import { buildAnnotationFeatures } from "../../core/utils/features";
import { AnnotateChrome } from "../../paint/chrome";
import { toLatLngs } from "./path";

export function LeafletAnnotateLayers({
  annotations = [],
  draft,
  selectedId,
  hoveredId = null,
  defaultColor,
  defaultStrokeWidth,
  labelsEditable = true,
  renderArrowHead,
  renderLabel,
  onSelect,
  onLabelChange,
  onUpdate,
  onHandleDragEnd,
}: Pick<
  AnnotateProps,
  | "annotations"
  | "draft"
  | "selectedId"
  | "defaultColor"
  | "defaultStrokeWidth"
  | "labelsEditable"
  | "renderArrowHead"
  | "renderLabel"
  | "onSelect"
  | "onLabelChange"
  | "onUpdate"
> & {
  hoveredId?: string | null;
  onHandleDragEnd?: (id: string) => void;
}) {
  const color = defaultColor ?? DEFAULT_COLOR;
  const strokeWidth = defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const { lines, fills, dashed, bounds, arrows, markers } =
    buildAnnotationFeatures({
      annotations,
      draft,
      selectedId,
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
              weight: skipOutline ? 0 : strokeWidth,
              opacity: skipOutline ? 0 : 1,
            }}
          />
        );
      })}

      {lines.features.map((feature, index) => (
        <Polyline
          key={`line-${index}`}
          positions={toLatLngs(feature.geometry.coordinates as LngLat[])}
          interactive={false}
          pathOptions={{
            color: String(feature.properties?.color ?? color),
            weight: Number(feature.properties?.strokeWidth ?? strokeWidth),
            opacity: 0.95,
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
        hoveredId={hoveredId}
        color={color}
        labelsEditable={labelsEditable}
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
