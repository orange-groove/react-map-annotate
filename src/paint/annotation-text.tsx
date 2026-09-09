"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DEFAULT_LABELS } from "../core/constants";
import type { Annotation, SelectOptions, TextAnnotation } from "../core/types";
import { moveAnnotation, resizeText, textFontSize } from "../core/utils/edit";
import { isAdditiveSelect, nextSelectedIds } from "../core/utils/selection";
import { handleInteraction } from "../core/utils/interaction";
import { useMapGl } from "../engines/kit/context";
import { startHandleDrag } from "../interaction/pointer-drag";
import { useOptionalAnnotate } from "../session/annotate-context";

export function AnnotationText({
  annotation,
  selected,
  active,
  color,
  editable,
  onSelect,
  onUpdate,
  onUpdateMany,
  onDragEnd,
  onLabelChange,
  annotations = [],
  selectedIds = [],
}: {
  annotation: TextAnnotation;
  selected: boolean;
  active: boolean;
  color: string;
  editable: boolean;
  onSelect?: (id: string, options?: SelectOptions) => void;
  onUpdate?: (annotation: Annotation) => void;
  onUpdateMany?: (annotations: Annotation[]) => void;
  onDragEnd?: (id: string) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
  annotations?: Annotation[];
  selectedIds?: string[];
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const session = useOptionalAnnotate();
  const originRef = useRef(annotation);
  const [editing, setEditing] = useState(
    selected && annotation.label === DEFAULT_LABELS.text,
  );
  const [value, setValue] = useState(annotation.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const fontSize = textFontSize(annotation);
  const fill = annotation.style?.color ?? color;
  const display = editing
    ? value || DEFAULT_LABELS.text
    : annotation.label.trim() || DEFAULT_LABELS.text;

  useEffect(() => {
    if (!editing) setValue(annotation.label);
  }, [annotation.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const next = value.trim() || DEFAULT_LABELS.text;
    setEditing(false);
    setValue(next);
    if (next !== annotation.label) {
      onLabelChange?.(annotation.id, next, { ...annotation, label: next });
    }
  }

  function onMovePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (editing) return;
    const map = maps.current?.getMap();
    if (!map) return;
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
    if (additive) return;
    const originals = annotations.filter((item) => nextIds.includes(item.id));
    originRef.current = annotation;
    session?.beginEdit();
    startHandleDrag(
      event,
      map,
      annotation.coordinate,
      (point, grab) => {
        if (originals.length > 1 && onUpdateMany) {
          onUpdateMany(
            originals.map((item) =>
              moveAnnotation(item, grab.from, point, { preview: true }),
            ),
          );
          return;
        }
        onUpdate?.(
          moveAnnotation(originRef.current, grab.from, point, {
            preview: true,
          }),
        );
      },
      () => onDragEnd?.(annotation.id),
    );
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const map = maps.current?.getMap();
    if (!map) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(annotation.id);
    originRef.current = annotation;
    const startSize = textFontSize(annotation);
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    const originX = box?.left ?? event.clientX;
    const originY = box?.top ?? event.clientY;
    const startDist =
      Math.hypot(event.clientX - originX, event.clientY - originY) || 1;
    const panWasEnabled = map.dragPan.isEnabled();
    map.dragPan.disable();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    session?.beginEdit();

    const move = (next: PointerEvent) => {
      const dist = Math.hypot(next.clientX - originX, next.clientY - originY);
      onUpdate?.(resizeText(originRef.current, startSize * (dist / startDist)));
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
      anchor="center"
      rotationAlignment="viewport"
      pitchAlignment="viewport"
      style={{ zIndex: selected ? 3 : 2 }}
    >
      <div
        className={`rma-text${selected ? " rma-text--selected" : ""}${
          editing ? " rma-text--editing" : ""
        }`}
        data-rma-handle
        data-rma-text={annotation.id}
        style={{
          color: fill,
          fontSize,
          fontFamily: annotation.style?.fontFamily,
          cursor: editing ? "text" : "grab",
          transform: annotation.rotation
            ? `rotate(${annotation.rotation}deg)`
            : undefined,
        }}
        onPointerDown={onMovePointerDown}
        onDoubleClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          if (!editable) return;
          onSelect?.(annotation.id);
          setEditing(true);
        }}
      >
        <span className="rma-text-sizer" aria-hidden={editing}>
          {display}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            className="rma-text-input"
            value={value}
            size={1}
            aria-label="Text annotation"
            placeholder={DEFAULT_LABELS.text}
            onChange={(event) => setValue(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
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
        ) : null}
        {active ? (
          <button
            type="button"
            className="rma-text-resize"
            aria-label="Resize text"
            onPointerDown={onResizePointerDown}
          />
        ) : null}
      </div>
    </Marker>
  );
}
