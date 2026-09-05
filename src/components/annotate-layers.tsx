"use client";

import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  LAYER_IDS,
  SOURCE_IDS,
} from "../constants";
import { useMapGl } from "../gl/context";
import type { AnnotateProps, Annotation } from "../types";
import { labelAnchor } from "../utils/annotations";
import { buildAnnotationFeatures } from "../utils/features";
import { AnnotationLabel } from "./annotation-label";
import { AnnotationMarker } from "./annotation-marker";
import { DefaultArrowHead } from "./arrow-head";
import { DraftVertices, EditHandles } from "./edit-handles";

export function AnnotateLayers({
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
  const { Source, Layer, Marker } = useMapGl();
  const color = defaultColor ?? DEFAULT_COLOR;
  const strokeWidth = defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const { lines, fills, dashed, bounds, samples, arrows, markers } =
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
      <Source id={SOURCE_IDS.fills} type="geojson" data={fills}>
        <Layer
          id={LAYER_IDS.fill}
          type="fill"
          paint={{
            "fill-color": ["get", "color"],
            "fill-opacity": ["get", "fillOpacity"],
          }}
        />
        <Layer
          id={LAYER_IDS.fillOutline}
          type="line"
          filter={[
            "any",
            ["!=", ["get", "id"], "draft"],
            ["!=", ["get", "kind"], "polygon"],
          ]}
          paint={{
            "line-color": ["get", "color"],
            "line-width": strokeWidth,
          }}
        />
      </Source>

      <Source id={SOURCE_IDS.lines} type="geojson" data={lines}>
        <Layer
          id={LAYER_IDS.lineHit}
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": 18,
            "line-opacity": 0,
          }}
        />
        <Layer
          id={LAYER_IDS.line}
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": ["get", "strokeWidth"],
            "line-opacity": 0.95,
          }}
        />
      </Source>

      <Source id={SOURCE_IDS.dashed} type="geojson" data={dashed}>
        <Layer
          id={LAYER_IDS.dashed}
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": ["get", "strokeWidth"],
            "line-dasharray": [0.75, 1.75],
            "line-opacity": 0.9,
          }}
        />
      </Source>

      <Source id={SOURCE_IDS.bounds} type="geojson" data={bounds}>
        <Layer
          id={LAYER_IDS.boundsHit}
          type="fill"
          paint={{
            "fill-color": ["get", "color"],
            "fill-opacity": 0,
          }}
        />
        <Layer
          id={LAYER_IDS.bounds}
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": 1.25,
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
          }}
        />
      </Source>

      <Source id={SOURCE_IDS.samples} type="geojson" data={samples}>
        <Layer
          id={LAYER_IDS.samples}
          type="circle"
          paint={{
            "circle-radius": 2.25,
            "circle-color": color,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          }}
        />
      </Source>

      {arrows.map((arrow) => (
        <Marker
          key={`${arrow.id}-${arrow.direction}`}
          longitude={arrow.coordinate[0]}
          latitude={arrow.coordinate[1]}
          anchor="center"
          rotationAlignment="map"
          pitchAlignment="map"
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
