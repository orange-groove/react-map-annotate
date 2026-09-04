"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { Marker, useMap } from "react-map-gl/mapbox";
import type { Annotation, AreaAnnotation, LngLat } from "../types";
import {
  circleResizeHandle,
  editableVertices,
  movePolygonVertex,
  resizeCircle,
  resizeRectangleVertex,
} from "../utils/edit";
import { clientToLngLat, handleInteraction } from "../utils/interaction";

function CircleResizeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 7 L17 17" />
      <path d="M13 7 H7 V13" />
      <path d="M11 17 H17 V11" />
    </svg>
  );
}

function HandleMarker({
  coordinate,
  className,
  label,
  onDrag,
  onDragEnd,
}: {
  coordinate: LngLat;
  className: string;
  label: string;
  onDrag: (point: LngLat) => void;
  onDragEnd?: () => void;
}) {
  const maps = useMap();

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const map = maps.current?.getMap();
    if (!map) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const panWasEnabled = map.dragPan.isEnabled();
    map.dragPan.disable();

    const move = (next: PointerEvent) => {
      onDrag(clientToLngLat(map, next.clientX, next.clientY));
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
        className={className}
        data-rmga-handle
        role="slider"
        aria-label={label}
        onPointerDown={onPointerDown}
      >
        {className.includes("rmga-resize") ? <CircleResizeIcon /> : null}
      </div>
    </Marker>
  );
}

export function EditHandles({
  annotations,
  activeId,
  onUpdate,
  onDragEnd,
}: {
  annotations: Annotation[];
  activeId: string | null;
  onUpdate?: (annotation: Annotation) => void;
  onDragEnd?: (id: string) => void;
}) {
  if (!activeId) return null;
  const annotation = annotations.find((item) => item.id === activeId);
  if (!annotation) return null;

  if (annotation.kind === "circle") {
    const handle = circleResizeHandle(annotation);
    if (!handle) return null;
    return (
      <HandleMarker
        coordinate={handle}
        className="rmga-handle rmga-resize"
        label="Resize circle"
        onDrag={(point) => onUpdate?.(resizeCircle(annotation, point))}
        onDragEnd={() => onDragEnd?.(annotation.id)}
      />
    );
  }

  if (annotation.kind === "polygon" || annotation.kind === "rectangle") {
    return (
      <>
        {editableVertices(annotation).map((coordinate, index) => (
          <HandleMarker
            key={`${annotation.id}-${index}`}
            coordinate={coordinate}
            className="rmga-handle rmga-vertex"
            label={`Resize ${annotation.kind} vertex ${index + 1}`}
            onDrag={(point) => {
              const area = annotation as AreaAnnotation;
              onUpdate?.(
                annotation.kind === "rectangle"
                  ? resizeRectangleVertex(area, index, point)
                  : movePolygonVertex(area, index, point),
              );
            }}
            onDragEnd={() => onDragEnd?.(annotation.id)}
          />
        ))}
      </>
    );
  }

  return null;
}

export function DraftVertices({ coordinates }: { coordinates: LngLat[] }) {
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
            className={`rmga-handle rmga-vertex${index === 0 ? " rmga-vertex--first" : ""}`}
            data-rmga-handle
            aria-hidden
          />
        </Marker>
      ))}
    </>
  );
}
