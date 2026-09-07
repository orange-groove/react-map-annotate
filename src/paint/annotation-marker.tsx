"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useMapGl } from "../engines/kit/context";
import type { MarkerClickEvent } from "../engines/kit/types";
import type { Annotation, MarkerAnnotation } from "../core/types";
import { moveAnnotation } from "../core/utils/edit";
import { startHandleDrag } from "../interaction/pointer-drag";

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
  const scale = selected ? 1.15 : 1;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const map = maps.current?.getMap();
    if (!map) return;
    onSelect?.(annotation.id);
    originRef.current = annotation.coordinate;
    startHandleDrag(
      event,
      map,
      annotation.coordinate,
      (point, grab) => {
        onUpdate?.(
          moveAnnotation(
            { ...annotation, coordinate: originRef.current },
            grab.from,
            point,
          ),
        );
      },
      () => onDragEnd?.(annotation.id),
    );
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
      onClick={(event: MarkerClickEvent) => {
        event.originalEvent.stopPropagation();
        onSelect?.(annotation.id);
      }}
    >
      <div
        className="rma-marker-hit"
        data-rma-handle
        style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
      >
        <DefaultPin color={annotation.style?.color ?? color} scale={scale} />
      </div>
    </Marker>
  );
}
