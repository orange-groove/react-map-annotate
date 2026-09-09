"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { HANDLE_HIT_PX } from "../core/constants";
import { useMapGl } from "../engines/kit/context";
import type { Annotation, LngLat, SelectOptions } from "../core/types";
import {
  applyEditHandle,
  canRemoveVertex,
  editHandleCursor,
  editHandlesFor,
  type EditHandleHit,
} from "../core/utils/edit";
import { startHandleDrag } from "../interaction/pointer-drag";
import { isAdditiveSelect } from "../core/utils/selection";
import { useOptionalAnnotate } from "../session/annotate-context";

function CircleResizeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#000000"
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

function RotateIcon() {
  return <RotateCw size={14} strokeWidth={2} aria-hidden />;
}

function isIconHandle(kind: EditHandleHit["kind"]) {
  return kind === "resize" || kind === "rotate";
}

function handleHitStyle(kind: EditHandleHit["kind"]): CSSProperties {
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
  kind: EditHandleHit["kind"] = "vertex",
  selected = false,
): CSSProperties {
  return {
    background: kind === "insert" ? "transparent" : "#ffffff",
    borderStyle: "solid",
    borderWidth: kind === "insert" ? 1.5 : 2,
    borderColor: "#000000",
    borderRadius: "50%",
    boxSizing: "border-box",
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.9)",
    color: "#000000",
    pointerEvents: "none",
    opacity: kind === "insert" ? 0.85 : 1,
    ...(isIconHandle(kind)
      ? {
          display: "grid",
          placeItems: "center",
          width: 22,
          height: 22,
          lineHeight: 0,
        }
      : kind === "insert"
        ? { width: 8, height: 8 }
        : { width: selected ? 13 : 11, height: selected ? 13 : 11 }),
  };
}

function HandleMarker({
  annotation,
  handle,
  label,
  selected,
  onUpdate,
  onDragStart,
  onDragEnd,
  onSelect,
  onRemove,
}: {
  annotation: Annotation;
  handle: EditHandleHit & { coordinate: LngLat };
  label: string;
  selected: boolean;
  onUpdate?: (annotation: Annotation) => void;
  onDragEnd?: () => void;
  onDragStart?: () => void;
  onSelect?: (options?: SelectOptions) => void;
  onRemove?: () => void;
}) {
  const { Marker, useMap } = useMapGl();
  const maps = useMap();
  const originRef = useRef(annotation);
  const { coordinate, kind } = handle;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const map = maps.current?.getMap();
    if (!map) return;
    if (isAdditiveSelect(event)) {
      event.preventDefault();
      event.stopPropagation();
      onSelect?.({ additive: true });
      return;
    }
    originRef.current = annotation;
    onDragStart?.();
    onSelect?.();
    startHandleDrag(
      event,
      map,
      coordinate,
      (point, grab) => {
        onUpdate?.(
          applyEditHandle(originRef.current, handle, point, {
            map,
            from: grab.from,
            handleAt: grab.handle,
            preview: true,
          }),
        );
      },
      onDragEnd,
      editHandleCursor(handle, true),
    );
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
        className="rma-handle"
        style={handleHitStyle(kind)}
        data-rma-handle
        role="slider"
        aria-label={label}
        aria-valuenow={handle.index}
        onPointerDown={onPointerDown}
        onDoubleClick={(event) => {
          if (kind !== "vertex" || !onRemove) return;
          event.preventDefault();
          event.stopPropagation();
          onSelect?.();
          onRemove();
        }}
      >
        <div
          className={
            kind === "resize"
              ? "rma-resize"
              : kind === "rotate"
                ? "rma-rotate"
                : kind === "insert"
                  ? "rma-vertex rma-vertex--insert"
                  : `rma-vertex${selected ? " rma-vertex--selected" : ""}`
          }
          style={handleVisualStyle(kind, selected)}
        >
          {kind === "resize" ? <CircleResizeIcon /> : null}
          {kind === "rotate" ? <RotateIcon /> : null}
        </div>
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
  const { useMap } = useMapGl();
  const maps = useMap();
  const map = maps.current?.getMap();
  const session = useOptionalAnnotate();
  const [dragId, setDragId] = useState<string | null>(null);
  const visibleId = dragId ?? activeId;

  if (!visibleId) return null;
  const annotation = annotations.find((item) => item.id === visibleId);
  if (!annotation) return null;

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
          annotation={annotation}
          handle={handle}
          selected={
            !dragId &&
            handle.kind === "vertex" &&
            session?.selectedId === annotation.id &&
            session.selectedVertexIndex === handle.index
          }
          label={
            handle.kind === "resize"
              ? annotation.kind === "draw"
                ? "Resize drawing"
                : "Resize circle"
              : handle.kind === "rotate"
                ? `Rotate ${annotation.kind === "draw" ? "drawing" : annotation.kind}`
                : handle.kind === "insert"
                  ? `Add ${annotation.kind} vertex`
                  : `Resize ${annotation.kind} vertex ${handle.index + 1}`
          }
          onSelect={(options) => {
            session?.setSelectedId(annotation.id, options);
            if (options?.additive) return;
            if (handle.kind === "insert") {
              session?.setSelectedVertexIndex(handle.index + 1);
              return;
            }
            if (
              handle.kind === "vertex" &&
              canRemoveVertex(annotation, handle.index)
            ) {
              session?.setSelectedVertexIndex(handle.index);
              return;
            }
            session?.setSelectedVertexIndex(null);
          }}
          onUpdate={onUpdate}
          onDragStart={() => {
            setDragId(annotation.id);
            session?.beginEdit();
          }}
          onDragEnd={() => {
            setDragId(null);
            onDragEnd?.(annotation.id);
          }}
          onRemove={
            handle.kind === "vertex"
              ? () => session?.removeSelected()
              : undefined
          }
        />
      ))}
    </>
  );
}

export function DraftVertices({ coordinates }: { coordinates: LngLat[] }) {
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
            className="rma-handle"
            style={handleHitStyle("vertex")}
            data-rma-handle
            aria-hidden
          >
            <div
              className={`rma-vertex${index === 0 ? " rma-vertex--first" : ""}`}
              style={handleVisualStyle()}
            />
          </div>
        </Marker>
      ))}
    </>
  );
}
