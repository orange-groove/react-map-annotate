"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_COLOR, HANDLE_HIT_PX } from "../constants";
import { useMapGl } from "../gl/context";
import type { Annotation, LngLat } from "../types";
import {
  applyEditHandle,
  editHandleCursor,
  editHandlesFor,
} from "../utils/edit";
import { clientToLngLat, handleInteraction } from "../utils/interaction";

function CircleResizeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "block" }}
    >
      <path d="M2 2 L14 14" />
      <path d="M7.5 2 H2 V7.5" />
      <path d="M8.5 14 H14 V8.5" />
    </svg>
  );
}

function handleHitStyle(kind: "vertex" | "resize"): CSSProperties {
  const size = HANDLE_HIT_PX * 2;
  return {
    display: "grid",
    placeItems: "center",
    width: size,
    height: size,
    background: "transparent",
    boxSizing: "border-box",
    cursor: editHandleCursor({ kind, index: 0 }),
  };
}

function handleVisualStyle(
  color: string,
  kind: "vertex" | "resize" = "vertex",
): CSSProperties {
  return {
    background: "#ffffff",
    borderStyle: "solid",
    borderWidth: 2,
    borderColor: color,
    borderRadius: "50%",
    boxSizing: "border-box",
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.9)",
    color,
    pointerEvents: "none",
    ...(kind === "resize"
      ? {
          display: "grid",
          placeItems: "center",
          width: 22,
          height: 22,
          lineHeight: 0,
        }
      : { width: 11, height: 11 }),
  };
}

function HandleMarker({
  coordinate,
  kind,
  color,
  label,
  onDrag,
  onDragEnd,
}: {
  coordinate: LngLat;
  kind: "vertex" | "resize";
  color: string;
  label: string;
  onDrag: (point: LngLat, grab: { from: LngLat; handle: LngLat }) => void;
  onDragEnd?: () => void;
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const map = maps.current?.getMap();
    if (!map) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const panWasEnabled = map.dragPan.isEnabled();
    map.dragPan.disable();
    const grab = {
      from: clientToLngLat(map, event.clientX, event.clientY),
      handle: coordinate,
    };

    const move = (next: PointerEvent) => {
      onDrag(clientToLngLat(map, next.clientX, next.clientY), grab);
    };
    const up = (next: PointerEvent) => {
      move(next);
      handleInteraction.suppressClickUntil = Date.now() + 400;
      if (panWasEnabled) map.dragPan.enable();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDragEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <Marker
      longitude={coordinate[0]}
      latitude={coordinate[1]}
      anchor="center"
      rotationAlignment="viewport"
      pitchAlignment="viewport"
    >
      <div
        className="rmga-handle"
        style={handleHitStyle(kind)}
        data-rmga-handle
        role="slider"
        aria-label={label}
        onPointerDown={onPointerDown}
      >
        <div
          className={kind === "resize" ? "rmga-resize" : "rmga-vertex"}
          style={handleVisualStyle(color, kind)}
        >
          {kind === "resize" ? <CircleResizeIcon /> : null}
        </div>
      </div>
    </Marker>
  );
}

export function EditHandles({
  annotations,
  activeId,
  defaultColor = DEFAULT_COLOR,
  onUpdate,
  onDragEnd,
}: {
  annotations: Annotation[];
  activeId: string | null;
  defaultColor?: string;
  onUpdate?: (annotation: Annotation) => void;
  onDragEnd?: (id: string) => void;
}) {
  const { useMap } = useMapGl();
  const maps = useMap();
  const map = maps.current?.getMap();

  if (!activeId) return null;
  const annotation = annotations.find((item) => item.id === activeId);
  if (!annotation) return null;
  const color = annotation.style?.color ?? defaultColor;

  const handles = editHandlesFor(
    annotation,
    map ? (lngLat) => map.project(lngLat) : undefined,
  );
  if (handles.length === 0) return null;

  return (
    <>
      {handles.map((handle) => (
        <HandleMarker
          key={`${annotation.id}-${handle.kind}-${handle.index}`}
          coordinate={handle.coordinate}
          kind={handle.kind}
          color={color}
          label={
            handle.kind === "resize"
              ? "Resize circle"
              : annotation.kind === "polygon" || annotation.kind === "rectangle"
                ? `Resize ${annotation.kind} vertex ${handle.index + 1}`
                : `Resize ${annotation.kind} ${handle.index === 0 ? "start" : "end"}`
          }
          onDrag={(point, grab) =>
            onUpdate?.(
              applyEditHandle(annotation, handle, point, {
                map: maps.current?.getMap(),
                from: grab.from,
                handleAt: grab.handle,
              }),
            )
          }
          onDragEnd={() => onDragEnd?.(annotation.id)}
        />
      ))}
    </>
  );
}

export function DraftVertices({
  coordinates,
  color = DEFAULT_COLOR,
}: {
  coordinates: LngLat[];
  color?: string;
}) {
  const { Marker } = useMapGl();
  return (
    <>
      {coordinates.map((coordinate, index) => (
        <Marker
          key={`draft-vertex-${index}`}
          longitude={coordinate[0]}
          latitude={coordinate[1]}
          anchor="center"
        >
          <div
            className="rmga-handle"
            style={handleHitStyle("vertex")}
            data-rmga-handle
            aria-hidden
          >
            <div
              className={`rmga-vertex${index === 0 ? " rmga-vertex--first" : ""}`}
              style={handleVisualStyle(color)}
            />
          </div>
        </Marker>
      ))}
    </>
  );
}
