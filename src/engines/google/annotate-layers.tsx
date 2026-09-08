"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Polygon, Polyline } from "@vis.gl/react-google-maps";
import { DEFAULT_COLOR, DEFAULT_STROKE_WIDTH } from "../../core/constants";
import type { AnnotateProps, LngLat } from "../../core/types";
import { buildAnnotationFeatures } from "../../core/utils/features";
import { AnnotateChrome } from "../../paint/chrome";
import { useMapGl } from "../kit/context";
import type { MapLike, MapPoint } from "../kit/types";

function toPath(coordinates: LngLat[]) {
  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function overlayPath(
  project: MapLike["project"],
  coordinates: LngLat[],
): string {
  return coordinates
    .map((coordinate, index) => {
      const point = project({ lng: coordinate[0], lat: coordinate[1] });
      return `${index === 0 ? "M" : "L"}${point.x} ${point.y}`;
    })
    .join(" ");
}

function GoogleTracePreview({
  coordinates,
  color,
  strokeWidth,
}: {
  coordinates: LngLat[] | null;
  color: string;
  strokeWidth: number;
}) {
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
      const node = map?.getOverlayHost?.() ?? null;
      if (!map || !node?.isConnected) {
        retry = window.setTimeout(attach, 16);
        return;
      }
      setHost(node);
      unsubscribe = map.subscribeRender?.(() => {
        setTick((value) => value + 1);
      });
    };
    attach();
    return () => {
      cancelled = true;
      if (retry != null) window.clearTimeout(retry);
      unsubscribe?.();
    };
  }, [maps]);

  if (!coordinates || coordinates.length < 2) return null;
  if (!host?.isConnected) {
    return (
      <>
        <Polyline
          path={toPath(coordinates)}
          clickable={false}
          geodesic={false}
          strokeColor={color}
          strokeOpacity={0.22}
          strokeWeight={strokeWidth + 8}
        />
        <Polyline
          path={toPath(coordinates)}
          clickable={false}
          geodesic={false}
          strokeColor={color}
          strokeOpacity={0.95}
          strokeWeight={strokeWidth + 2}
        />
      </>
    );
  }
  const map = maps.current?.getMap();
  const project =
    map?.projectDiv ?? map?.project ?? (() => ({ x: 0, y: 0 }) as MapPoint);
  void tick;
  const path = overlayPath(project, coordinates);
  return createPortal(
    <svg className="rma-overlay-svg" overflow="visible" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.22}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.95}
      />
    </svg>,
    host,
  );
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

      <GoogleTracePreview
        coordinates={tracePreview}
        color={color}
        strokeWidth={strokeWidth}
      />
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
