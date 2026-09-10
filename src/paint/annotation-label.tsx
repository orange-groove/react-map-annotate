"use client";

import * as React from "react";
import { useMapGl } from "../engines/kit/context";
import type {
  Annotation,
  LabelRenderProps,
  SelectOptions,
} from "../core/types";
import { isAdditiveSelect } from "../core/utils/selection";
import { annotationAreaMeters } from "../core/utils/annotations";
import { moveAnnotation } from "../core/utils/edit";
import { formatArea } from "../core/utils/geo";
import { startHandleDrag } from "../interaction/pointer-drag";
import { useOptionalAnnotate } from "../session/annotate-context";

/**
 * A label is a handle on its annotation, not just a caption. The pointer has
 * to travel this far before we treat it as a drag, so a click still selects
 * and a double-click still renames.
 */
const LABEL_DRAG_THRESHOLD_PX = 3;

export function AnnotationLabel({
  annotation,
  longitude,
  latitude,
  selected,
  editable,
  offset,
  markerAnchor = "bottom",
  showLabel = true,
  showArea = true,
  annotations = [],
  selectedIds = [],
  onSelect,
  onLabelChange,
  onUpdate,
  onUpdateMany,
  onDragEnd,
  render,
}: {
  annotation: Annotation;
  longitude: number;
  latitude: number;
  selected: boolean;
  editable: boolean;
  offset?: [number, number];
  markerAnchor?: "center" | "bottom";
  showLabel?: boolean;
  showArea?: boolean;
  annotations?: Annotation[];
  selectedIds?: string[];
  onSelect?: (id: string, options?: SelectOptions) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
  onUpdate?: (annotation: Annotation) => void;
  onUpdateMany?: (annotations: Annotation[]) => void;
  onDragEnd?: (id: string) => void;
  render?: (props: LabelRenderProps) => React.ReactNode;
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const session = useOptionalAnnotate();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(annotation.label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setValue(annotation.label);
  }, [annotation.label, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const next = value.trim();
    setEditing(false);
    if (next !== annotation.label) {
      onLabelChange?.(annotation.id, next, { ...annotation, label: next });
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (isAdditiveSelect(event)) {
      onSelect?.(annotation.id, { additive: true });
      return;
    }
    onSelect?.(annotation.id);
    if (editing || !onUpdate) return;
    const map = maps.current?.getMap();
    if (!map) return;
    // Whatever is selected when the drag starts travels with it.
    const moving =
      selectedIds.includes(annotation.id) && selectedIds.length > 1
        ? annotations.filter((item) => selectedIds.includes(item.id))
        : [annotation];
    startHandleDrag(
      event,
      map,
      [longitude, latitude],
      (point, grab) => {
        const moved = moving.map((item) =>
          moveAnnotation(item, grab.from, point, { preview: true }),
        );
        if (moved.length > 1 && onUpdateMany) onUpdateMany(moved);
        else if (moved[0]) onUpdate(moved[0]);
      },
      () => onDragEnd?.(annotation.id),
      "grabbing",
      {
        thresholdPx: LABEL_DRAG_THRESHOLD_PX,
        onDragStart: () => session?.beginEdit(),
      },
    );
  }

  const areaMeters = annotationAreaMeters(annotation);
  const areaLabel =
    showArea && areaMeters != null ? formatArea(areaMeters) : null;
  const name = showLabel ? annotation.label.trim() : "";
  const caption = annotation.caption?.trim() || null;

  if (!editing && !name && !render && !areaLabel && !caption) return null;

  const labelClassName = [
    "rma-label",
    selected ? "rma-label--selected" : "",
    markerAnchor === "center" ? "rma-label--centered" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderProps: LabelRenderProps = {
    annotation,
    selected,
    editable,
    longitude,
    latitude,
    offset,
    areaLabel,
    caption,
    showLabel,
    showArea,
    onSelect,
    onLabelChange,
  };
  const custom = render?.(renderProps);
  if (render && custom == null) return null;

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor={markerAnchor}
      offset={offset}
      style={{ zIndex: selected ? 2 : 1 }}
    >
      {render ? (
        <div data-rma-label={annotation.id} onPointerDown={onPointerDown}>
          {custom}
        </div>
      ) : (
        <div
          data-rma-label={annotation.id}
          className={labelClassName}
          onPointerDown={onPointerDown}
          onDoubleClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            if (editable) setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="rma-label-input"
              value={value}
              aria-label="Annotation label"
              onChange={(event) => setValue(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commit();
                if (event.key === "Escape") {
                  setValue(annotation.label);
                  setEditing(false);
                }
              }}
            />
          ) : name ? (
            <button
              type="button"
              className="rma-label-text"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {annotation.label}
            </button>
          ) : null}
          {caption ? <div className="rma-label-area">{caption}</div> : null}
          {areaLabel ? <div className="rma-label-area">{areaLabel}</div> : null}
        </div>
      )}
    </Marker>
  );
}
