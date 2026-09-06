import * as React from "react";
import {
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
} from "../core/constants";
import type {
  AnnotateTool,
  Annotation,
  DraftAnnotation,
  LngLat,
} from "../core/types";
import {
  annotationFromDraft,
  canFinishDraft,
  committedDraftCoordinates,
  minVerticesForKind,
} from "../core/utils/annotations";
import {
  applyEditHandle,
  editHandleCursor,
  editHandlesFor,
  moveAnnotation,
  type EditHandleHit,
} from "../core/utils/edit";
import { haversineDistance } from "../core/utils/geo";
import {
  eventLngLat,
  handleInteraction,
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
} from "../core/utils/interaction";
import { useMapGl } from "../engines/kit/context";
import type { MapPointerEvent, MapRef } from "../engines/kit/types";
import { hitAnnotationId, resolveHandleTarget } from "./hit";

export interface MapDrawingLatest {
  annotations: Annotation[];
  draft: DraftAnnotation | null;
  tool: AnnotateTool;
  selectedId: string | null;
  defaultColor: string;
  sampleIntervalMeters: number;
  onAdd?: (annotation: Annotation) => void;
  onUpdate?: (annotation: Annotation) => void;
  onDelete?: (id: string) => void;
  onDraftChange?: (draft: DraftAnnotation | null) => void;
  onToolChange?: (tool: AnnotateTool) => void;
  onSelect?: (id: string | null) => void;
}

export function useMapDrawing({
  interactive,
  latestRef,
  tool,
}: {
  interactive: boolean;
  latestRef: React.MutableRefObject<MapDrawingLatest>;
  tool: AnnotateTool;
}) {
  const { useMap } = useMapGl();
  const maps = useMap();
  const dragRef = React.useRef(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const hoverIdRef = React.useRef<string | null>(null);
  const setHoverId = React.useCallback((id: string | null) => {
    hoverIdRef.current = id;
    setHoveredId(id);
  }, []);
  const suppressClickRef = React.useRef(false);
  const editRef = React.useRef<{
    id: string;
    start: LngLat;
    original: Annotation;
    handle?: EditHandleHit;
    handleAt?: LngLat;
  } | null>(null);

  const resolveMap = React.useCallback(() => {
    return maps.current ?? null;
  }, [maps]);

  const commitDraft = React.useCallback(
    (nextDraft: DraftAnnotation | null = latestRef.current.draft) => {
      const map = resolveMap()?.getMap();
      const annotation = nextDraft
        ? annotationFromDraft(nextDraft, {
            map,
            sampleIntervalMeters: latestRef.current.sampleIntervalMeters,
            color: latestRef.current.defaultColor,
          })
        : null;
      latestRef.current.onDraftChange?.(null);
      if (annotation) {
        latestRef.current.onAdd?.(annotation);
        latestRef.current.onSelect?.(annotation.id);
      }
    },
    [latestRef, resolveMap],
  );

  const finishDrawing = React.useCallback(() => {
    const current = latestRef.current.draft;
    if (canFinishDraft(current)) {
      commitDraft(current);
    } else {
      latestRef.current.onDraftChange?.(null);
    }
    latestRef.current.onToolChange?.("select");
  }, [commitDraft, latestRef]);

  React.useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    let retry: number | undefined;
    let detach: (() => void) | undefined;

    const attach = () => {
      if (cancelled) return;
      const map = resolveMap()?.getMap();
      if (!map) {
        retry = window.setTimeout(attach, 50);
        return;
      }

      const drawing = isDrawingTool(latestRef.current.tool);

      if (drawing) {
        map.dragPan.disable();
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
      }

      const onMouseDown = (event: MapPointerEvent) => {
        if (event.originalEvent.button !== 0) return;
        if (isUiTarget(event.originalEvent.target)) return;
        const {
          tool: activeTool,
          draft: current,
          annotations: items,
        } = latestRef.current;
        const hitId = current ? null : hitAnnotationId(map, event.point, items);
        const handleTarget = current
          ? null
          : resolveHandleTarget(
              map,
              event.point,
              items,
              hoverIdRef.current,
              hitId,
            );
        if (handleTarget) {
          const handleAt = editHandlesFor(handleTarget.annotation, (lngLat) =>
            map.project(lngLat),
          ).find(
            (item) =>
              item.kind === handleTarget.handle.kind &&
              item.index === handleTarget.handle.index,
          )?.coordinate;
          editRef.current = {
            id: handleTarget.annotation.id,
            start: eventLngLat(event),
            original: handleTarget.annotation,
            handle: handleTarget.handle,
            handleAt,
          };
          suppressClickRef.current = false;
          latestRef.current.onSelect?.(handleTarget.annotation.id);
          setHoverId(handleTarget.annotation.id);
          map.dragPan.disable();
          map.getCanvas().style.cursor = editHandleCursor(handleTarget.handle);
          return;
        }
        if (hitId) {
          const original = items.find((item) => item.id === hitId);
          if (original) {
            editRef.current = {
              id: hitId,
              start: eventLngLat(event),
              original,
            };
            suppressClickRef.current = false;
            latestRef.current.onSelect?.(hitId);
            setHoverId(hitId);
            map.dragPan.disable();
            map.getCanvas().style.cursor = "grabbing";
            return;
          }
        }
        if (!isDrawingTool(activeTool) || !isDragTool(activeTool)) return;
        dragRef.current = true;
        latestRef.current.onDraftChange?.({
          kind: activeTool,
          coordinates: [eventLngLat(event)],
          cursor: eventLngLat(event),
        });
      };

      const onMouseMove = (event: MapPointerEvent) => {
        const { tool: activeTool, draft: current } = latestRef.current;
        const point = eventLngLat(event);
        const edit = editRef.current;
        if (edit) {
          if (haversineDistance(edit.start, point) > 1) {
            suppressClickRef.current = true;
          }
          if (edit.handle) {
            latestRef.current.onUpdate?.(
              applyEditHandle(edit.original, edit.handle, point, {
                map,
                from: edit.start,
                handleAt: edit.handleAt,
              }),
            );
            map.getCanvas().style.cursor = editHandleCursor(edit.handle);
          } else {
            latestRef.current.onUpdate?.(
              moveAnnotation(edit.original, edit.start, point),
            );
            map.getCanvas().style.cursor = "grabbing";
          }
          return;
        }
        if (!current) {
          const items = latestRef.current.annotations;
          const nextHover = hitAnnotationId(map, event.point, items);
          const handleTarget = resolveHandleTarget(
            map,
            event.point,
            items,
            hoverIdRef.current,
            nextHover,
          );
          const activeId = handleTarget?.annotation.id ?? nextHover;
          setHoverId(activeId);
          if (handleTarget) {
            map.getCanvas().style.cursor = editHandleCursor(
              handleTarget.handle,
            );
          } else if (nextHover) {
            map.getCanvas().style.cursor = "grab";
          } else if (isDrawingTool(activeTool)) {
            map.getCanvas().style.cursor = "crosshair";
          } else {
            map.getCanvas().style.cursor = "";
          }
        }
        if (!isDrawingTool(activeTool)) return;

        if (activeTool === "draw" && dragRef.current && current) {
          const last = current.coordinates[current.coordinates.length - 1];
          const nextCoordinates =
            last && haversineDistance(last, point) < 2
              ? current.coordinates
              : [...current.coordinates, point];
          latestRef.current.onDraftChange?.({
            ...current,
            coordinates: nextCoordinates,
            cursor: point,
          });
          return;
        }

        if (
          (activeTool === "circle" || activeTool === "rectangle") &&
          current
        ) {
          latestRef.current.onDraftChange?.({ ...current, cursor: point });
          return;
        }

        if (isClickVertexTool(activeTool)) {
          if (!current) return;
          latestRef.current.onDraftChange?.({ ...current, cursor: point });
        }
      };

      const onMouseUp = (event: MapPointerEvent) => {
        if (editRef.current) {
          const editedId = editRef.current.id;
          editRef.current = null;
          setHoverId(editedId);
          if (!isDrawingTool(latestRef.current.tool)) {
            map.dragPan.enable();
            map.getCanvas().style.cursor = "";
          } else {
            map.getCanvas().style.cursor = "crosshair";
          }
          return;
        }
        if (!dragRef.current) return;
        dragRef.current = false;
        const { tool: activeTool, draft: current } = latestRef.current;
        if (!current || !isDragTool(activeTool)) return;
        const next: DraftAnnotation = {
          ...current,
          cursor: eventLngLat(event),
        };
        if (activeTool === "draw") {
          commitDraft({
            ...next,
            coordinates: committedDraftCoordinates(next),
          });
          return;
        }
        commitDraft(next);
      };

      const onClick = (event: MapPointerEvent) => {
        if (isUiTarget(event.originalEvent.target)) return;
        if (
          suppressClickRef.current ||
          Date.now() < handleInteraction.suppressClickUntil
        ) {
          suppressClickRef.current = false;
          return;
        }
        const {
          tool: activeTool,
          draft: current,
          annotations: items,
        } = latestRef.current;
        const point = eventLngLat(event);
        const hitId = current ? null : hitAnnotationId(map, event.point, items);

        if (hitId) {
          latestRef.current.onSelect?.(hitId);
          return;
        }

        if (activeTool === "select") {
          latestRef.current.onSelect?.(null);
          return;
        }

        if (activeTool === "marker") {
          commitDraft({ kind: "marker", coordinates: [point] });
          return;
        }

        if (!isClickVertexTool(activeTool)) return;

        if (!current) {
          latestRef.current.onDraftChange?.({
            kind: activeTool,
            coordinates: [point],
            cursor: point,
          });
          return;
        }

        if (
          activeTool === "polygon" &&
          current.coordinates.length >= 3 &&
          nearFirstVertex(map, current.coordinates[0], point)
        ) {
          commitDraft(current);
          return;
        }

        const nextCoordinates = [...current.coordinates, point];
        if (activeTool !== "polygon" && nextCoordinates.length >= 2) {
          commitDraft({
            ...current,
            coordinates: nextCoordinates,
            cursor: undefined,
          });
          return;
        }

        latestRef.current.onDraftChange?.({
          ...current,
          coordinates: nextCoordinates,
          cursor: point,
        });
      };

      const onDblClick = (event: MapPointerEvent) => {
        const { tool: activeTool, draft: current } = latestRef.current;
        if (!current || !isClickVertexTool(activeTool)) return;
        event.preventDefault();
        const coordinates = current.coordinates.slice();
        if (
          coordinates.length > minVerticesForKind(current.kind) &&
          lastTwoEqual(coordinates)
        ) {
          coordinates.pop();
        }
        if (canFinishDraft({ ...current, coordinates })) {
          commitDraft({ ...current, coordinates, cursor: undefined });
        }
      };

      map.on("mousedown", onMouseDown);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
      map.on("click", onClick);
      map.on("dblclick", onDblClick);

      detach = () => {
        try {
          map.off("mousedown", onMouseDown);
          map.off("mousemove", onMouseMove);
          map.off("mouseup", onMouseUp);
          map.off("click", onClick);
          map.off("dblclick", onDblClick);
          map.dragPan.enable();
          const canvas = map.getCanvas();
          if (canvas) canvas.style.cursor = "";
        } catch {
          // Host map can be destroyed before this effect cleans up.
        }
      };
    };

    attach();

    return () => {
      cancelled = true;
      if (retry != null) window.clearTimeout(retry);
      detach?.();
    };
  }, [commitDraft, interactive, latestRef, resolveMap, setHoverId, tool]);

  return {
    hoveredId,
    setHoverId,
    resolveMap,
    commitDraft,
    finishDrawing,
    maps: maps as { current?: MapRef | null },
  };
}
