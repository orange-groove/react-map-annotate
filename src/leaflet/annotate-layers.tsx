"use client";

import { Polygon, Polyline } from "react-leaflet";
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from "../constants";
import { useMapGl } from "../gl/context";
import type { AnnotateProps, Annotation, LngLat } from "../types";
import { labelAnchor } from "../utils/annotations";
import { buildAnnotationFeatures } from "../utils/features";
import { AnnotationLabel } from "../components/annotation-label";
import { AnnotationMarker } from "../components/annotation-marker";
import { DefaultArrowHead } from "../components/arrow-head";
import { DraftVertices, EditHandles } from "../components/edit-handles";
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
  | "onSelect"
  | "onLabelChange"
  | "onUpdate"
> & {
  hoveredId?: string | null;
  onHandleDragEnd?: (id: string) => void;
}) {
  const { Marker } = useMapGl();
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
  const handleId = draft ? null : hoveredId;

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
              fillOpacity: Number(feature.properties?.fillOpacity ?? 0.18),
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

      {arrows.map((arrow) => (
        <Marker
          key={`${arrow.id}-${arrow.direction}`}
          longitude={arrow.coordinate[0]}
          latitude={arrow.coordinate[1]}
          anchor="center"
        >
          {(renderArrowHead ?? DefaultArrowHead)({
            direction: arrow.direction,
            bearing: arrow.bearing,
            color: arrow.color,
            selected: arrow.selected,
            size: 26,
          })}
        </Marker>
      ))}

      {markers.map((annotation) => (
        <AnnotationMarker
          key={`marker-${annotation.id}`}
          annotation={annotation}
          selected={selectedId === annotation.id}
          color={color}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDragEnd={onHandleDragEnd}
        />
      ))}

      {draft?.kind === "polygon" ? (
        <DraftVertices coordinates={draft.coordinates} color={color} />
      ) : null}

      <EditHandles
        annotations={annotations}
        activeId={handleId}
        defaultColor={color}
        onUpdate={onUpdate}
        onDragEnd={onHandleDragEnd}
      />

      {annotations.map((annotation: Annotation) => {
        const anchor = labelAnchor(annotation);
        if (!anchor) return null;
        return (
          <AnnotationLabel
            key={`label-${annotation.id}`}
            annotation={annotation}
            longitude={anchor[0]}
            latitude={anchor[1]}
            selected={annotation.id === selectedId}
            editable={labelsEditable}
            offset={annotation.kind === "marker" ? [0, -56] : [0, -8]}
            onSelect={onSelect}
            onLabelChange={onLabelChange}
          />
        );
      })}
    </>
  );
}
