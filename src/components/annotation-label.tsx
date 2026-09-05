"use client";

import * as React from "react";
import { useMapGl } from "../gl/context";
import type { Annotation } from "../types";

export function AnnotationLabel({
  annotation,
  longitude,
  latitude,
  selected,
  editable,
  offset,
  onSelect,
  onLabelChange,
}: {
  annotation: Annotation;
  longitude: number;
  latitude: number;
  selected: boolean;
  editable: boolean;
  offset?: [number, number];
  onSelect?: (id: string) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
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

  if (!editing && !annotation.label.trim()) return null;

  return (
    <Marker
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      offset={offset}
      style={{ zIndex: selected ? 2 : 1 }}
    >
      <div
        data-rmga-label={annotation.id}
        className={`rmga-label${selected ? " rmga-label--selected" : ""}`}
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
            className="rmga-label-input"
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
            className="rmga-label-text"
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(annotation.id);
            }}
          >
            {annotation.label}
          </button>
        )}
      </div>
    </Marker>
  );
}
