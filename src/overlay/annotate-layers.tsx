"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from "../constants";
import { useMapGl } from "../gl/context";
import type { MapLike, MapPoint } from "../gl/types";
import type { AnnotateProps, Annotation, LngLat } from "../types";
import { labelAnchor } from "../utils/annotations";
import { buildAnnotationFeatures } from "../utils/features";
import { AnnotationLabel } from "../components/annotation-label";
import { AnnotationMarker } from "../components/annotation-marker";
import { DefaultArrowHead } from "../components/arrow-head";
import { DraftVertices, EditHandles } from "../components/edit-handles";

function pathFrom(
  project: MapLike["project"],
  coordinates: LngLat[],
  close = false,
): string {
  const commands = coordinates.map((coordinate, index) => {
    const point = project({ lng: coordinate[0], lat: coordinate[1] });
    return `${index === 0 ? "M" : "L"}${point.x} ${point.y}`;
  });
  if (close) commands.push("Z");
  return commands.join(" ");
}

const OverlayTickContext = React.createContext(0);

function OverlayRoot({ children }: { children: React.ReactNode }) {
  const { useMap } = useMapGl();
  const maps = useMap();
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    let unsubscribe: (() => void) | undefined;

    const attach = () => {
      if (cancelled) return;
      const map = maps.current?.getMap();
      if (!map) {
        retry = window.setTimeout(attach, 50);
        return;
      }
      const node = map.getOverlayHost?.() ?? null;
      if (!node) {
        retry = window.setTimeout(attach, 16);
        return;
      }
      setHost(node);
      unsubscribe = map.subscribeRender?.(() => {
        setTick((value) => value + 1);
      });
      setTick((value) => value + 1);
    };

    attach();

    return () => {
      cancelled = true;
      if (retry != null) window.clearTimeout(retry);
      unsubscribe?.();
      setHost(null);
    };
  }, [maps]);

  if (!host) return null;
  return createPortal(
    <OverlayTickContext.Provider value={tick}>
      {children}
    </OverlayTickContext.Provider>,
    host,
  );
}

type OverlayAnnotateLayersProps = Pick<
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
};

export function OverlayAnnotateLayers(props: OverlayAnnotateLayersProps) {
  return (
    <OverlayRoot>
      <OverlayPaint {...props} />
    </OverlayRoot>
  );
}

function OverlayPaint({
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
}: OverlayAnnotateLayersProps) {
  const tick = React.useContext(OverlayTickContext);
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const map = maps.current?.getMap();
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
  const project =
    map?.projectDiv ?? map?.project ?? (() => ({ x: 0, y: 0 }) as MapPoint);

  return (
    <>
      <svg
        className="rmga-overlay-svg"
        overflow="visible"
        aria-hidden
        data-rmga-tick={tick}
      >
        {fills.features.map((feature, index) => {
          const id = String(feature.properties?.id ?? index);
          const skipOutline =
            feature.properties?.id === "draft" &&
            feature.properties?.kind === "polygon";
          return (
            <path
              key={`fill-${id}-${index}`}
              d={pathFrom(
                project,
                feature.geometry.coordinates[0] as LngLat[],
                true,
              )}
              fill={String(feature.properties?.color ?? color)}
              fillOpacity={Number(feature.properties?.fillOpacity ?? 0.18)}
              stroke={
                skipOutline
                  ? "none"
                  : String(feature.properties?.color ?? color)
              }
              strokeWidth={skipOutline ? 0 : strokeWidth}
            />
          );
        })}
        {lines.features.map((feature, index) => (
          <path
            key={`line-${index}`}
            d={pathFrom(project, feature.geometry.coordinates as LngLat[])}
            fill="none"
            stroke={String(feature.properties?.color ?? color)}
            strokeWidth={Number(feature.properties?.strokeWidth ?? strokeWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.95}
          />
        ))}
        {dashed.features.map((feature, index) => (
          <path
            key={`dash-${index}`}
            d={pathFrom(project, feature.geometry.coordinates as LngLat[])}
            fill="none"
            stroke={String(feature.properties?.color ?? color)}
            strokeWidth={Number(feature.properties?.strokeWidth ?? strokeWidth)}
            strokeDasharray="4 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.9}
          />
        ))}
        {bounds.features.map((feature, index) => (
          <path
            key={`bounds-${index}`}
            d={pathFrom(
              project,
              feature.geometry.coordinates[0] as LngLat[],
              true,
            )}
            fill="none"
            stroke={String(feature.properties?.color ?? color)}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
          />
        ))}
        {samples.features.map((feature, index) => {
          const [lng, lat] = feature.geometry.coordinates;
          const point = project({ lng, lat });
          return (
            <circle
              key={`sample-${index}`}
              cx={point.x}
              cy={point.y}
              r={2.25}
              fill={color}
              stroke="#ffffff"
              strokeWidth={1}
            />
          );
        })}
      </svg>

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
