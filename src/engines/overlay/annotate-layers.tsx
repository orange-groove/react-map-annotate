"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_OPACITY,
  DEFAULT_STROKE_WIDTH,
} from "../../core/constants";
import { useMapGl } from "../kit/context";
import type { MapLike, MapPoint } from "../kit/types";
import type { AnnotateProps, LngLat } from "../../core/types";
import { useAnnotationFeatures } from "../../paint/use-annotation-features";
import { AnnotateChrome } from "../../paint/chrome";

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
}: OverlayAnnotateLayersProps) {
  const tick = React.useContext(OverlayTickContext);
  const { useMap } = useMapGl();
  const maps = useMap();
  const map = maps.current?.getMap();
  const color = defaultColor ?? DEFAULT_COLOR;
  const strokeWidth = defaultStrokeWidth ?? DEFAULT_STROKE_WIDTH;
  const { lines, fills, dashed, bounds, samples, arrows, markers } =
    useAnnotationFeatures({
      annotations,
      draft,
      selectedId,
      selectedIds,
      hoveredId,
      defaultColor: color,
      defaultStrokeWidth: strokeWidth,
    });
  const project =
    map?.projectDiv ?? map?.project ?? (() => ({ x: 0, y: 0 }) as MapPoint);

  return (
    <>
      <svg
        className="rma-overlay-svg"
        overflow="visible"
        aria-hidden
        data-rma-tick={tick}
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
              fillOpacity={Number(feature.properties?.fillOpacity ?? 0)}
              stroke={
                skipOutline
                  ? "none"
                  : String(feature.properties?.color ?? color)
              }
              strokeWidth={
                skipOutline
                  ? 0
                  : Number(feature.properties?.strokeWidth ?? strokeWidth)
              }
              strokeOpacity={Number(
                feature.properties?.strokeOpacity ?? DEFAULT_STROKE_OPACITY,
              )}
            />
          );
        })}
        {tracePreview && tracePreview.length >= 2 ? (
          <path
            d={pathFrom(project, tracePreview)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth + 8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.22}
          />
        ) : null}
        {tracePreview && tracePreview.length >= 2 ? (
          <path
            d={pathFrom(project, tracePreview)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth + 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.95}
          />
        ) : null}
        {lines.features.map((feature, index) => (
          <path
            key={`line-${index}`}
            d={pathFrom(project, feature.geometry.coordinates as LngLat[])}
            fill="none"
            stroke={String(feature.properties?.color ?? color)}
            strokeWidth={Number(feature.properties?.strokeWidth ?? strokeWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={Number(
              feature.properties?.strokeOpacity ?? DEFAULT_STROKE_OPACITY,
            )}
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
