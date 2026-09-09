"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useMapGl } from "../engines/kit/context";
import type { MarkerClickEvent } from "../engines/kit/types";
import type {
  Annotation,
  MarkerAnnotation,
  SelectOptions,
} from "../core/types";
import { moveAnnotation } from "../core/utils/edit";
import { isAdditiveSelect, nextSelectedIds } from "../core/utils/selection";
import { startHandleDrag } from "../interaction/pointer-drag";

function DefaultPin({ color, scale = 1 }: { color?: string; scale?: number }) {
  return (
    <svg
      width={27 * scale}
      height={40 * scale}
      viewBox="0 0 27 40"
      aria-hidden
      style={{ display: "block", pointerEvents: "none" }}
    >
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
  onUpdateMany,
  onDragEnd,
  annotations = [],
  selectedIds = [],
}: {
  annotation: MarkerAnnotation;
  selected: boolean;
  color: string;
  onSelect?: (id: string, options?: SelectOptions) => void;
  onUpdate?: (annotation: Annotation) => void;
  onUpdateMany?: (annotations: Annotation[]) => void;
  onDragEnd?: (id: string) => void;
  annotations?: Annotation[];
  selectedIds?: string[];
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const originRef = useRef(annotation.coordinate);
  const selectedAtRef = useRef(0);
  const scale = selected ? 1.15 : 1;
  const pinColor = annotation.style?.color ?? color;

  function selectFromEvent(event: unknown) {
    const additive = isAdditiveSelect(event);
    const already = selectedIds.includes(annotation.id);
    const nextIds =
      already && !additive
        ? selectedIds
        : nextSelectedIds(annotations, selectedIds, annotation.id, additive);
    if (!already || additive) {
      if (additive) onSelect?.(annotation.id, { additive: true });
      else onSelect?.(annotation.id);
    }
    return { additive, nextIds };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    selectedAtRef.current = Date.now();
    const { additive, nextIds } = selectFromEvent(event);
    if (additive) {
      event.preventDefault();
      return;
    }
    const map = maps.current?.getMap();
    if (!map) return;
    const originals = annotations.filter((item) => nextIds.includes(item.id));
    originRef.current = annotation.coordinate;
    startHandleDrag(
      event,
      map,
      annotation.coordinate,
      (point, grab) => {
        if (originals.length > 1 && onUpdateMany) {
          onUpdateMany(
            originals.map((item) => moveAnnotation(item, grab.from, point)),
          );
          return;
        }
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
      color={pinColor}
      scale={scale}
      style={{
        width: "max-content",
        height: "max-content",
        pointerEvents: "auto",
      }}
      onClick={(event: MarkerClickEvent) => {
        event.originalEvent.stopPropagation();
        if (Date.now() - selectedAtRef.current < 500) return;
        selectFromEvent(event.originalEvent);
      }}
    >
      <div
        className="rma-marker-hit"
        data-rma-marker={annotation.id}
        style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
      >
        <DefaultPin color={pinColor} scale={scale} />
      </div>
    </Marker>
  );
}
