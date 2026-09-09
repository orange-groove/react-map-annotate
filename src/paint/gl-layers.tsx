"use client";

import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  LAYER_IDS,
  SOURCE_IDS,
} from "../core/constants";
import { useMapGl } from "../engines/kit/context";
import type { AnnotateProps, LngLat } from "../core/types";
import { buildAnnotationFeatures } from "../core/utils/features";
import { AnnotateChrome } from "./chrome";

export function AnnotateLayers({
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
  const { Source, Layer } = useMapGl();
  const color = defaultColor ?? DEFAULT_COLOR;
  const strokeWidth = defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const { lines, fills, dashed, bounds, samples, arrows, markers } =
    buildAnnotationFeatures({
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
            "line-width": ["get", "strokeWidth"],
            "line-opacity": ["get", "strokeOpacity"],
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
            "line-opacity": ["get", "strokeOpacity"],
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

      <Source
        id={SOURCE_IDS.trace}
        type="geojson"
        data={{
          type: "FeatureCollection",
          features:
            tracePreview && tracePreview.length >= 2
              ? [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: { type: "LineString", coordinates: tracePreview },
                  },
                ]
              : [],
        }}
      >
        <Layer
          id={LAYER_IDS.traceHalo}
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": color,
            "line-width": strokeWidth + 12,
            "line-opacity": 0.35,
          }}
        />
        <Layer
          id={LAYER_IDS.trace}
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": color,
            "line-width": strokeWidth + 2,
            "line-opacity": 0.95,
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
