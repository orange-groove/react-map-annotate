"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useMapGl } from "../gl/context";
import type { Annotation, MarkerAnnotation } from "../types";
import { moveAnnotation } from "../utils/edit";
import { clientToLngLat, handleInteraction } from "../utils/interaction";

function DefaultPin({ color, scale = 1 }: { color?: string; scale?: number }) {
  return (
    <svg width={27 * scale} height={40 * scale} viewBox="0 0 27 40" aria-hidden>
      <path
        d="M13.5 0 C6 0 0 6.2 0 13.8 C0 24.2 13.5 40 13.5 40 S27 24.2 27 13.8 C27 6.2 21 0 13.5 0 Z"
        fill={color ?? "#ea4335"}
        stroke="#ffffff"
        strokeWidth="1.25"
      />
      <circle cx="13.5" cy="13.5" r="4.2" fill="#ffffff" />
    </svg>
  );
}

export function AnnotationMarker({
  annotation,
  selected,
  color,
  onSelect,
  onUpdate,
  onDragEnd,
}: {
  annotation: MarkerAnnotation;
  selected: boolean;
  color: string;
  onSelect?: (id: string) => void;
  onUpdate?: (annotation: Annotation) => void;
  onDragEnd?: (id: string) => void;
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const originRef = useRef(annotation.coordinate);
  const startRef = useRef(annotation.coordinate);
  const scale = selected ? 1.15 : 1;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const map = maps.current?.getMap();
    if (!map) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const panWasEnabled = map.dragPan.isEnabled();
    map.dragPan.disable();
    onSelect?.(annotation.id);
    originRef.current = annotation.coordinate;
    startRef.current = clientToLngLat(map, event.clientX, event.clientY);

    const move = (next: PointerEvent) => {
      const live = maps.current?.getMap();
      if (!live) return;
      onUpdate?.(
        moveAnnotation(
          { ...annotation, coordinate: originRef.current },
          startRef.current,
          clientToLngLat(live, next.clientX, next.clientY),
        ),
      );
    };
    const up = (next: PointerEvent) => {
      move(next);
      handleInteraction.suppressClickUntil = Date.now() + 400;
      if (panWasEnabled) map.dragPan.enable();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onDragEnd?.(annotation.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <Marker
      longitude={annotation.coordinate[0]}
      latitude={annotation.coordinate[1]}
      anchor="bottom"
      rotationAlignment="viewport"
      pitchAlignment="viewport"
      color={annotation.style?.color ?? color}
      scale={scale}
      onClick={(event) => {
        event.originalEvent.stopPropagation();
        onSelect?.(annotation.id);
      }}
    >
      <div
        className="rmga-marker-hit"
        data-rmga-handle
        style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
      >
        <DefaultPin color={annotation.style?.color ?? color} scale={scale} />
      </div>
    </Marker>
  );
}
