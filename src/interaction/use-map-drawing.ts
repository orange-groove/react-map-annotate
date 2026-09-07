import * as React from "react";
import {
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
  isPointTool,
  isTraceTool,
} from "../core/constants";
import type {
  AnnotateTool,
  Annotation,
  DraftAnnotation,
  LngLat,
  TraceHit,
  TraceOption,
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
  setMapCursor,
  setPointerCursor,
} from "../core/utils/interaction";
import { useMapGl } from "../engines/kit/context";
import type { MapPointerEvent, MapRef } from "../engines/kit/types";
import {
  copySelectedAnnotation,
  duplicateSelectedAnnotation,
  resolveAnnotationContextMenu,
  type AnnotationContextMenuState,
  pasteAnnotationAtPointer,
} from "./clipboard-actions";
import { resolveTrace, sameTracePath } from "../core/utils/trace";
import { hitAnnotationId, resolveHandleTarget } from "./hit";

export interface MapDrawingLatest {
  annotations: Annotation[];
  draft: DraftAnnotation | null;
  tool: AnnotateTool;
  selectedId: string | null;
  defaultColor: string;
  defaultFontFamily?: string;
  sampleIntervalMeters: number;
  onAdd?: (annotation: Annotation) => void;
  onUpdate?: (annotation: Annotation) => void;
  onDelete?: (id: string) => void;
  onDraftChange?: (draft: DraftAnnotation | null) => void;
  onToolChange?: (tool: AnnotateTool) => void;
  onSelect?: (id: string | null) => void;
  setSelectedVertexIndex?: (index: number | null) => void;
  undo?: () => void;
  redo?: () => void;
  endEdit?: () => void;
  removeSelected?: () => void;
  trace?: TraceOption;
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
  const lastPointerRef = React.useRef<LngLat | null>(null);
  const [tracePreview, setTracePreview] = React.useState<LngLat[] | null>(null);
  const [contextMenu, setContextMenu] =
    React.useState<AnnotationContextMenuState | null>(null);
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
      dragRef.current = false;
      const map = resolveMap()?.getMap();
      const annotation = nextDraft
        ? annotationFromDraft(nextDraft, {
            map,
            sampleIntervalMeters: latestRef.current.sampleIntervalMeters,
            color: latestRef.current.defaultColor,
            fontFamily: latestRef.current.defaultFontFamily,
          })
        : null;
      latestRef.current.draft = null;
      latestRef.current.onDraftChange?.(null);
      setTracePreview(null);
      if (annotation) {
        latestRef.current.onAdd?.(annotation);
        latestRef.current.onSelect?.(annotation.id);
      }
    },
    [latestRef, resolveMap],
  );

  const copySelected = React.useCallback(() => {
    return copySelectedAnnotation(
      latestRef.current,
      latestRef.current.selectedId ?? hoverIdRef.current,
    );
  }, [latestRef]);

  const duplicateSelected = React.useCallback(() => {
    return duplicateSelectedAnnotation(
      latestRef.current,
      resolveMap()?.getMap() ?? null,
      latestRef.current.selectedId ?? hoverIdRef.current,
    );
  }, [latestRef, resolveMap]);

  const pasteAtPointer = React.useCallback(() => {
    return pasteAnnotationAtPointer(
      latestRef.current,
      lastPointerRef.current,
      resolveMap()?.getMap() ?? null,
    );
  }, [latestRef, resolveMap]);

  const finishDrawing = React.useCallback(() => {
    const current = latestRef.current.draft;
    dragRef.current = false;
    if (current) {
      const clicked = { ...current, cursor: undefined };
      commitDraft(
        canFinishDraft(clicked)
          ? clicked
          : {
              ...current,
              coordinates: committedDraftCoordinates(current),
              cursor: undefined,
            },
      );
    } else {
      latestRef.current.draft = null;
      latestRef.current.onDraftChange?.(null);
      setTracePreview(null);
    }
    latestRef.current.onToolChange?.("select");
  }, [commitDraft, latestRef]);

  const cancelDrawing = React.useCallback(() => {
    dragRef.current = false;
    editRef.current = null;
    latestRef.current.draft = null;
    latestRef.current.onDraftChange?.(null);
    setTracePreview(null);
  }, [latestRef]);

  React.useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    let retry: number | undefined;
    let detach: (() => void) | undefined;
    let attempts = 0;

    const attach = () => {
      if (cancelled) return;
      const map = resolveMap()?.getMap();
      if (!map || (!map.isStyleLoaded() && attempts < 40)) {
        attempts += 1;
        retry = window.setTimeout(attach, 50);
        return;
      }

      const drawing =
        isDrawingTool(latestRef.current.tool) &&
        !isTraceTool(latestRef.current.tool);

      if (drawing) {
        map.dragPan.disable();
        setMapCursor(map, "crosshair");
      } else if (isTraceTool(latestRef.current.tool)) {
        map.dragPan.enable();
        setMapCursor(map, "crosshair");
      } else {
        map.dragPan.enable();
        setMapCursor(map, "");
      }

      const pushDraft = (next: DraftAnnotation | null) => {
        latestRef.current.draft = next;
        latestRef.current.onDraftChange?.(next);
      };

      let hoverGen = 0;
      const settleTrace = (
        result: ReturnType<typeof resolveTrace>,
        onHit: (hit: TraceHit | null) => void,
      ) => {
        if (result && typeof (result as Promise<unknown>).then === "function") {
          void Promise.resolve(result).then(onHit, () => onHit(null));
          return;
        }
        onHit(result as TraceHit | null);
      };
      const applyTraceHit = (hit: TraceHit | null) => {
        const current = latestRef.current.draft;
        setTracePreview(hit?.coordinates ?? null);
        if (hit) {
          if (
            !current ||
            current.kind !== "trace" ||
            !sameTracePath(current.coordinates, hit.coordinates)
          ) {
            pushDraft({ kind: "trace", coordinates: hit.coordinates });
          }
        } else if (current?.kind === "trace") {
          pushDraft(null);
        }
        setMapCursor(map, "crosshair");
      };
      const hoverTrace = (point: LngLat, screen: { x: number; y: number }) => {
        const gen = ++hoverGen;
        settleTrace(
          resolveTrace(latestRef.current.trace, point, {
            map,
            point: screen,
            phase: "hover",
          }),
          (hit) => {
            if (gen !== hoverGen) return;
            applyTraceHit(hit);
          },
        );
      };

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
          latestRef.current.setSelectedVertexIndex?.(
            handleTarget.handle.kind === "insert"
              ? handleTarget.handle.index + 1
              : handleTarget.handle.kind === "vertex"
                ? handleTarget.handle.index
                : null,
          );
          setHoverId(handleTarget.annotation.id);
          map.dragPan.disable();
          setMapCursor(map, editHandleCursor(handleTarget.handle));
          setPointerCursor(editHandleCursor(handleTarget.handle));
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
            setMapCursor(map, "grabbing");
            setPointerCursor("grabbing");
            return;
          }
        }
        if (isTraceTool(activeTool)) return;
        if (!isDrawingTool(activeTool) || !isDragTool(activeTool)) return;
        dragRef.current = true;
        const start = eventLngLat(event);
        pushDraft({
          kind: activeTool,
          coordinates: [start],
          cursor: start,
        });
      };

      const onMouseMove = (event: MapPointerEvent) => {
        const { tool: activeTool, draft: current } = latestRef.current;
        const point = eventLngLat(event);
        lastPointerRef.current = point;
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
            setMapCursor(map, editHandleCursor(edit.handle));
            setPointerCursor(editHandleCursor(edit.handle));
          } else {
            latestRef.current.onUpdate?.(
              moveAnnotation(edit.original, edit.start, point),
            );
            setMapCursor(map, "grabbing");
            setPointerCursor("grabbing");
          }
          return;
        }
        if (isTraceTool(activeTool)) {
          hoverTrace(point, event.point);
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
            setMapCursor(map, editHandleCursor(handleTarget.handle));
          } else if (nextHover) {
            setMapCursor(map, "grab");
          } else if (isDrawingTool(activeTool)) {
            setMapCursor(map, "crosshair");
          } else {
            setMapCursor(map, "");
          }
        }
        if (!isDrawingTool(activeTool)) return;

        if (activeTool === "draw" && dragRef.current && current) {
          const last = current.coordinates[current.coordinates.length - 1];
          const nextCoordinates =
            last && haversineDistance(last, point) < 2
              ? current.coordinates
              : [...current.coordinates, point];
          pushDraft({
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
          latestRef.current.endEdit?.();
          setHoverId(editedId);
          setPointerCursor(null);
          if (!isDrawingTool(latestRef.current.tool)) {
            map.dragPan.enable();
            setMapCursor(map, "");
          } else {
            setMapCursor(map, "crosshair");
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
        if (isTraceTool(activeTool)) {
          const existing = current
            ? null
            : hitAnnotationId(map, event.point, items);
          if (existing) {
            latestRef.current.onSelect?.(existing);
            return;
          }
          const draft = latestRef.current.draft;
          if (draft?.kind === "trace" && draft.coordinates.length >= 2) {
            setTracePreview(null);
            commitDraft(draft);
            return;
          }
          settleTrace(
            resolveTrace(latestRef.current.trace, point, {
              map,
              point: event.point,
              phase: "draw",
            }),
            (hit) => {
              if (hit) {
                setTracePreview(null);
                commitDraft({ kind: "trace", coordinates: hit.coordinates });
              }
            },
          );
          return;
        }
        const hitId = current ? null : hitAnnotationId(map, event.point, items);

        if (hitId) {
          latestRef.current.onSelect?.(hitId);
          return;
        }

        if (activeTool === "select") {
          latestRef.current.onSelect?.(null);
          return;
        }

        if (isPointTool(activeTool)) {
          commitDraft({ kind: activeTool, coordinates: [point] });
          if (activeTool === "text") {
            latestRef.current.onToolChange?.("select");
          }
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
        if (current && isClickVertexTool(activeTool)) {
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
          return;
        }
        const items = latestRef.current.annotations;
        const hitId = hitAnnotationId(map, event.point, items);
        const handleTarget = resolveHandleTarget(
          map,
          event.point,
          items,
          hoverIdRef.current,
          hitId,
        );
        if (handleTarget?.handle.kind === "vertex") {
          event.preventDefault();
          latestRef.current.onSelect?.(handleTarget.annotation.id);
          latestRef.current.setSelectedVertexIndex?.(handleTarget.handle.index);
          latestRef.current.removeSelected?.();
        }
      };

      const onContextMenu = (event: MouseEvent | MapPointerEvent) => {
        const mouse =
          event instanceof MouseEvent
            ? event
            : event.originalEvent instanceof MouseEvent
              ? event.originalEvent
              : null;
        if (!mouse) return;
        const next = resolveAnnotationContextMenu(mouse, {
          latest: latestRef.current,
          map,
        });
        if (!next) return;
        lastPointerRef.current = next.lngLat;
        if (next.annotationId) {
          latestRef.current.onSelect?.(next.annotationId);
        }
        setContextMenu(next);
      };

      const onCanvasMove = (event: PointerEvent) => {
        if (!isTraceTool(latestRef.current.tool)) return;
        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const screen = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const lngLat = map.unproject([screen.x, screen.y]);
        hoverTrace([lngLat.lng, lngLat.lat], screen);
      };

      map.on("mousedown", onMouseDown);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
      map.on("click", onClick);
      map.on("dblclick", onDblClick);
      map.on("contextmenu", onContextMenu);
      window.addEventListener("contextmenu", onContextMenu, true);
      const canvas = map.getCanvas();
      canvas.addEventListener("contextmenu", onContextMenu, true);
      canvas.addEventListener("pointermove", onCanvasMove, true);

      detach = () => {
        try {
          map.off("mousedown", onMouseDown);
          map.off("mousemove", onMouseMove);
          map.off("mouseup", onMouseUp);
          map.off("click", onClick);
          map.off("dblclick", onDblClick);
          map.off("contextmenu", onContextMenu);
          window.removeEventListener("contextmenu", onContextMenu, true);
          canvas.removeEventListener("pointermove", onCanvasMove, true);
          map
            .getCanvas()
            .removeEventListener("contextmenu", onContextMenu, true);
          map.dragPan.enable();
          setPointerCursor(null);
          setMapCursor(map, "");
          setTracePreview(null);
        } catch {
          window.removeEventListener("contextmenu", onContextMenu, true);
          setPointerCursor(null);
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
    tracePreview,
    setHoverId,
    resolveMap,
    commitDraft,
    finishDrawing,
    cancelDrawing,
    copySelected,
    duplicateSelected,
    pasteAtPointer,
    contextMenu,
    setContextMenu,
    maps: maps as { current?: MapRef | null },
  };
}
