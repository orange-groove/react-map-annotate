"use client";

import { Polygon, Polyline } from "@vis.gl/react-google-maps";
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from "../../core/constants";
import type { AnnotateProps, LngLat } from "../../core/types";
import { buildAnnotationFeatures } from "../../core/utils/features";
import { AnnotateChrome } from "../../paint/chrome";

function toPath(coordinates: LngLat[]) {
  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function dashIcons(color: string): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        strokeColor: color,
        scale: 2,
      },
      offset: "0",
      repeat: "14px",
    },
  ];
}

export function GoogleAnnotateLayers({
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
            paths={toPath(feature.geometry.coordinates[0] as LngLat[])}
            clickable={false}
            fillColor={featureColor}
            fillOpacity={Number(feature.properties?.fillOpacity ?? 0)}
            strokeColor={featureColor}
            strokeOpacity={skipOutline ? 0 : 1}
            strokeWeight={skipOutline ? 0 : strokeWidth}
          />
        );
      })}

      {lines.features.map((feature, index) => (
        <Polyline
          key={`line-${index}`}
          path={toPath(feature.geometry.coordinates as LngLat[])}
          clickable={false}
          geodesic={false}
          strokeColor={String(feature.properties?.color ?? color)}
          strokeOpacity={0.95}
          strokeWeight={Number(feature.properties?.strokeWidth ?? strokeWidth)}
        />
      ))}

      {dashed.features.map((feature, index) => {
        const featureColor = String(feature.properties?.color ?? color);
        return (
          <Polyline
            key={`dash-${index}`}
            path={toPath(feature.geometry.coordinates as LngLat[])}
            clickable={false}
            geodesic={false}
            strokeOpacity={0}
            strokeWeight={Number(
              feature.properties?.strokeWidth ?? strokeWidth,
            )}
            icons={dashIcons(featureColor)}
          />
        );
      })}

      {bounds.features.map((feature, index) => {
        const featureColor = String(feature.properties?.color ?? color);
        return (
          <Polyline
            key={`bounds-${index}`}
            path={toPath(feature.geometry.coordinates[0] as LngLat[])}
            clickable={false}
            geodesic={false}
            strokeOpacity={0}
            strokeWeight={1.25}
            icons={dashIcons(featureColor)}
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
