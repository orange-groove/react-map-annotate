"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { DEFAULT_COLOR } from "../core/constants";
import type { Annotation } from "../core/types";
import {
  groupVisualScreenBounds,
  overlayVisualRects,
  padScreenRect,
  type ScreenRect,
} from "../core/utils/hit-test";
import { useMapGl } from "../engines/kit/context";
import type { MapLike, MapPointerEvent } from "../engines/kit/types";

const GROUP_BOUNDS_PAD = 4;
const MAP_EVENTS = [
  "move",
  "moveend",
  "zoom",
  "zoomend",
  "bounds_changed",
] as const;

function overlayHost(map: MapLike): HTMLElement | null {
  const canvas = map.getCanvas();
  return (
    map.getOverlayHost?.() ??
    (canvas instanceof HTMLCanvasElement ? canvas.parentElement : canvas) ??
    (canvas instanceof HTMLElement ? canvas : null)
  );
}

function projectPoint(map: MapLike, lngLat: { lng: number; lat: number }) {
  return map.projectDiv ? map.projectDiv(lngLat) : map.project(lngLat);
}

function sameRect(left: ScreenRect | null, right: ScreenRect | null): boolean {
  if (left == null || right == null) return left === right;
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function GroupHoverBounds({
  annotations,
  hoveredId,
  showLabels = true,
  defaultColor,
}: {
  annotations: Annotation[];
  hoveredId?: string | null;
  showLabels?: boolean;
  defaultColor?: string;
}) {
  const { useMap } = useMapGl();
  const maps = useMap();
  const [tick, setTick] = React.useState(0);
  const [rect, setRect] = React.useState<ScreenRect | null>(null);

  const hovered = hoveredId
    ? annotations.find((item) => item.id === hoveredId)
    : undefined;
  const grouped =
    hovered?.groupId != null &&
    annotations.filter((item) => item.groupId === hovered.groupId).length > 1;

  React.useEffect(() => {
    if (!grouped) return;
    const map = maps.current?.getMap();
    if (!map) return;
    const bump = () => setTick((value) => value + 1);
    const onMapEvent = bump as (event: MapPointerEvent) => void;
    for (const type of MAP_EVENTS) {
      try {
        map.on(type, onMapEvent);
      } catch {
        // Some engines only expose a subset of camera events.
      }
    }
    const unsubscribe = map.subscribeRender?.(bump);
    return () => {
      for (const type of MAP_EVENTS) {
        try {
          map.off(type, onMapEvent);
        } catch {
          // Matching on() may have been a no-op.
        }
      }
      unsubscribe?.();
    };
  }, [grouped, maps]);

  React.useLayoutEffect(() => {
    const current = hoveredId
      ? annotations.find((item) => item.id === hoveredId)
      : undefined;
    const members =
      current?.groupId != null
        ? annotations.filter((item) => item.groupId === current.groupId)
        : [];
    if (members.length < 2) {
      setRect((prev) => (prev == null ? prev : null));
      return;
    }
    const map = maps.current?.getMap();
    const host = map ? overlayHost(map) : null;
    if (!map || !host) {
      setRect((prev) => (prev == null ? prev : null));
      return;
    }
    const measure = () => {
      try {
        const overlayRects = overlayVisualRects(
          host,
          members.map((item) => item.id),
          showLabels,
        );
        const union = groupVisualScreenBounds(
          (lngLat) => projectPoint(map, lngLat),
          members,
          overlayRects,
          { includeLabels: showLabels },
        );
        const next = union ? padScreenRect(union, GROUP_BOUNDS_PAD) : null;
        setRect((prev) => (sameRect(prev, next) ? prev : next));
      } catch {
        setRect((prev) => (prev == null ? prev : null));
      }
    };
    measure();
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [annotations, hoveredId, maps, showLabels, tick]);

  if (!rect || (rect.width < 1 && rect.height < 1)) return null;
  const map = maps.current?.getMap();
  const host = map ? overlayHost(map) : null;
  if (!host) return null;
  const color = hovered?.style?.color ?? defaultColor ?? DEFAULT_COLOR;

  return createPortal(
    <div
      className="rma-group-bounds"
      data-rma-group-bounds=""
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        color,
      }}
    />,
    host,
  );
}
