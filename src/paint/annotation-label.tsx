"use client";

import * as React from "react";
import { useMapGl } from "../engines/kit/context";
import type { Annotation, LabelRenderProps } from "../core/types";

export function AnnotationLabel({
  annotation,
  longitude,
  latitude,
  selected,
  editable,
  offset,
  markerAnchor = "bottom",
  onSelect,
  onLabelChange,
  render,
}: {
  annotation: Annotation;
  longitude: number;
  latitude: number;
  selected: boolean;
  editable: boolean;
  offset?: [number, number];
  markerAnchor?: "center" | "bottom";
  onSelect?: (id: string) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
  render?: (props: LabelRenderProps) => React.ReactNode;
}) {
  const { Marker } = useMapGl();
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

  if (!editing && !annotation.label.trim() && !render) return null;

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
        <div
          data-rma-label={annotation.id}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect?.(annotation.id);
          }}
        >
          {custom}
        </div>
      ) : (
        <div
          data-rma-label={annotation.id}
          className={labelClassName}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect?.(annotation.id);
          }}
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
          ) : (
            <button
              type="button"
              className="rma-label-text"
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(annotation.id);
              }}
            >
              {annotation.label}
            </button>
          )}
        </div>
      )}
    </Marker>
  );
}
