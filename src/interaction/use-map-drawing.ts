import * as React from "react";
import {
  IDLE_TOOL,
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
  isPointTool,
  isTraceTool,
  emptyClickClearsSelection,
} from "../core/constants";
import type {
  AnnotateTool,
  Annotation,
  DraftAnnotation,
  LngLat,
  SelectOptions,
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
  canRemoveVertex,
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
import type { MapLike, MapPointerEvent, MapRef } from "../engines/kit/types";
import {
  copySelectedAnnotation,
  duplicateSelectedAnnotation,
  resolveAnnotationContextMenu,
  type AnnotationContextMenuState,
  pasteAnnotationAtPointer,
} from "./clipboard-actions";
import {
  expandGroupIds,
  isAdditiveSelect,
  nextSelectedIds,
  unionSelectedIds,
} from "../core/utils/selection";
import {
  idsInScreenRect,
  MARQUEE_MIN_PX,
  screenRectFromPoints,
  type ScreenRect,
} from "../core/utils/hit-test";
import { resolveTrace, sameTracePath } from "../core/utils/trace";
import { hitAnnotationId, resolveHandleTarget } from "./hit";

export interface MapDrawingLatest {
  annotations: Annotation[];
  draft: DraftAnnotation | null;
  tool: AnnotateTool;
  selectedId: string | null;
  selectedIds?: string[];
  defaultColor: string;
  defaultFontFamily?: string;
  sampleIntervalMeters: number;
  onAdd?: (annotation: Annotation) => void;
  onAddMany?: (annotations: Annotation[]) => void;
  onUpdate?: (annotation: Annotation) => void;
  onUpdateMany?: (annotations: Annotation[]) => void;
  onDelete?: (id: string) => void;
  onDraftChange?: (draft: DraftAnnotation | null) => void;
  onToolChange?: (tool: AnnotateTool) => void;
  onSelect?: (id: string | null, options?: SelectOptions) => void;
  setSelectedIds?: (ids: string[]) => void;
  setSelectedVertexIndex?: (index: number | null) => void;
  undo?: () => void;
  redo?: () => void;
  endEdit?: () => void;
  removeSelected?: () => void;
  groupSelected?: () => void;
  ungroupSelected?: () => void;
  trace?: TraceOption;
}

function currentSelectedIds(latest: MapDrawingLatest): string[] {
  return latest.selectedIds ?? (latest.selectedId ? [latest.selectedId] : []);
}

function applySelectedIds(
  latest: MapDrawingLatest,
  ids: string[],
  additive = false,
) {
  if (latest.setSelectedIds) {
    latest.setSelectedIds(ids);
    return;
  }
  const primary = ids[ids.length - 1] ?? null;
  if (additive && primary) latest.onSelect?.(primary, { additive: true });
  else latest.onSelect?.(primary);
}

function toolLocksMapPan(tool: AnnotateTool) {
  return tool === "select" || (isDrawingTool(tool) && !isTraceTool(tool));
}

function restorePanCursor(map: MapLike, tool: AnnotateTool) {
  if (toolLocksMapPan(tool)) {
    map.dragPan.disable();
    setMapCursor(map, tool === "select" ? "" : "crosshair");
    return;
  }
  map.dragPan.enable();
  setMapCursor(map, isTraceTool(tool) ? "crosshair" : "");
}

function disableNativeBoxZoom(map: MapLike): () => void {
  if (!map.boxZoom) return () => undefined;
  const wasEnabled = map.boxZoom.isEnabled?.() ?? true;
  map.boxZoom.disable();
  return () => {
    if (wasEnabled) map.boxZoom?.enable();
  };
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
  const [marquee, setMarquee] = React.useState<ScreenRect | null>(null);
  const marqueeRef = React.useRef<{
    start: { x: number; y: number };
    current: { x: number; y: number };
    additive: boolean;
  } | null>(null);
  const editRef = React.useRef<{
    id: string;
    start: LngLat;
    original: Annotation;
    originals: Annotation[];
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
    const latest = latestRef.current;
    const ids =
      latest.selectedIds?.length || latest.selectedId
        ? undefined
        : hoverIdRef.current;
    return copySelectedAnnotation(latest, ids);
  }, [latestRef]);

  const duplicateSelected = React.useCallback(() => {
    const latest = latestRef.current;
    const ids =
      latest.selectedIds?.length || latest.selectedId
        ? undefined
        : hoverIdRef.current;
    return duplicateSelectedAnnotation(
      latest,
      resolveMap()?.getMap() ?? null,
      ids,
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
    const discardTrace =
      isTraceTool(latestRef.current.tool) || current?.kind === "trace";
    if (current && !discardTrace) {
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
    latestRef.current.onToolChange?.(IDLE_TOOL);
  }, [commitDraft, latestRef]);

  const cancelDrawing = React.useCallback(() => {
    dragRef.current = false;
    editRef.current = null;
    marqueeRef.current = null;
    setMarquee(null);
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

      restorePanCursor(map, latestRef.current.tool);

      const restoreBoxZoom = disableNativeBoxZoom(map);

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
        if (!isTraceTool(latestRef.current.tool)) return;
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

      const additiveHeld = { current: false };
      const syncAdditiveHeld = (event: KeyboardEvent | MouseEvent) => {
        additiveHeld.current = Boolean(
          event.shiftKey || event.metaKey || event.ctrlKey,
        );
      };
      const eventIsAdditive = (event: MapPointerEvent) =>
        isAdditiveSelect(event) || additiveHeld.current;

      const onMouseDown = (event: MapPointerEvent) => {
        if (event.originalEvent.button !== 0) return;
        if (isUiTarget(event.originalEvent.target)) return;
        const additive = eventIsAdditive(event);
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
        if (handleTarget && !additive) {
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
            originals: [handleTarget.annotation],
            handle: handleTarget.handle,
            handleAt,
          };
          suppressClickRef.current = true;
          if (latestRef.current.setSelectedIds) {
            latestRef.current.setSelectedIds([handleTarget.annotation.id]);
          } else {
            latestRef.current.onSelect?.(handleTarget.annotation.id);
          }
          latestRef.current.setSelectedVertexIndex?.(
            handleTarget.handle.kind === "insert"
              ? handleTarget.handle.index + 1
              : handleTarget.handle.kind === "vertex" &&
                  canRemoveVertex(
                    handleTarget.annotation,
                    handleTarget.handle.index,
                  )
                ? handleTarget.handle.index
                : null,
          );
          setHoverId(handleTarget.annotation.id);
          map.dragPan.disable();
          setMapCursor(map, editHandleCursor(handleTarget.handle, true));
          setPointerCursor(editHandleCursor(handleTarget.handle, true));
          return;
        }
        const targetId =
          hitId ?? (additive ? (handleTarget?.annotation.id ?? null) : null);
        if (targetId) {
          const original = items.find((item) => item.id === targetId);
          if (original) {
            const currentIds = currentSelectedIds(latestRef.current);
            const already = currentIds.includes(targetId);
            const nextIds =
              already && !additive
                ? currentIds
                : nextSelectedIds(items, currentIds, targetId, additive);
            applySelectedIds(latestRef.current, nextIds, additive);
            suppressClickRef.current = true;
            setHoverId(targetId);
            if (additive) {
              event.preventDefault();
              return;
            }
            editRef.current = {
              id: targetId,
              start: eventLngLat(event),
              original,
              originals: items.filter((item) => nextIds.includes(item.id)),
            };
            map.dragPan.disable();
            setMapCursor(map, "grabbing");
            setPointerCursor("grabbing");
            return;
          }
        }
        if (isTraceTool(activeTool)) return;
        if (activeTool === "select") {
          event.preventDefault();
          marqueeRef.current = {
            start: event.point,
            current: event.point,
            additive,
          };
          setMarquee(screenRectFromPoints(event.point, event.point));
          map.dragPan.disable();
          setMapCursor(map, "crosshair");
          return;
        }
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
        const marqueeDrag = marqueeRef.current;
        if (marqueeDrag) {
          marqueeDrag.current = event.point;
          setMarquee(screenRectFromPoints(marqueeDrag.start, event.point));
          setMapCursor(map, "crosshair");
          return;
        }
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
            setMapCursor(map, editHandleCursor(edit.handle, true));
            setPointerCursor(editHandleCursor(edit.handle, true));
          } else if (edit.originals.length > 1) {
            const moved = edit.originals.map((item) =>
              moveAnnotation(item, edit.start, point),
            );
            if (latestRef.current.onUpdateMany) {
              latestRef.current.onUpdateMany(moved);
            } else {
              for (const item of moved) latestRef.current.onUpdate?.(item);
            }
            setMapCursor(map, "grabbing");
            setPointerCursor("grabbing");
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

      const finishMarquee = () => {
        const drag = marqueeRef.current;
        if (!drag) return false;
        marqueeRef.current = null;
        const rect = screenRectFromPoints(drag.start, drag.current);
        setMarquee(null);
        restorePanCursor(map, latestRef.current.tool);
        setPointerCursor(null);
        if (rect.width < MARQUEE_MIN_PX && rect.height < MARQUEE_MIN_PX) {
          if (
            emptyClickClearsSelection(latestRef.current.tool, drag.additive)
          ) {
            applySelectedIds(latestRef.current, []);
          }
          return false;
        }
        suppressClickRef.current = true;
        const items = latestRef.current.annotations;
        const hitIds = idsInScreenRect(
          (lngLat) => map.project(lngLat),
          rect,
          items,
        );
        const next = drag.additive
          ? unionSelectedIds(
              items,
              currentSelectedIds(latestRef.current),
              hitIds,
            )
          : expandGroupIds(items, hitIds);
        applySelectedIds(latestRef.current, next, drag.additive);
        return true;
      };

      const onWindowMouseUp = (event: MouseEvent) => {
        if (event.button !== 0) return;
        finishMarquee();
      };

      const onMouseUp = (event: MapPointerEvent) => {
        if (finishMarquee()) return;
        if (editRef.current) {
          const editedId = editRef.current.id;
          editRef.current = null;
          latestRef.current.endEdit?.();
          setHoverId(editedId);
          setPointerCursor(null);
          restorePanCursor(map, latestRef.current.tool);
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
          const additive = eventIsAdditive(event);
          if (latestRef.current.setSelectedIds) {
            applySelectedIds(
              latestRef.current,
              nextSelectedIds(
                items,
                currentSelectedIds(latestRef.current),
                hitId,
                additive,
              ),
              additive,
            );
          } else if (additive) {
            latestRef.current.onSelect?.(hitId, { additive: true });
          } else {
            latestRef.current.onSelect?.(hitId);
          }
          return;
        }

        if (
          emptyClickClearsSelection(activeTool, eventIsAdditive(event), current)
        ) {
          applySelectedIds(latestRef.current, []);
          return;
        }

        if (isPointTool(activeTool)) {
          commitDraft({ kind: activeTool, coordinates: [point] });
          if (activeTool === "text") {
            latestRef.current.onToolChange?.(IDLE_TOOL);
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
          const currentIds =
            latestRef.current.selectedIds ??
            (latestRef.current.selectedId
              ? [latestRef.current.selectedId]
              : []);
          if (!currentIds.includes(next.annotationId)) {
            if (latestRef.current.setSelectedIds) {
              latestRef.current.setSelectedIds(
                expandGroupIds(latestRef.current.annotations, [
                  next.annotationId,
                ]),
              );
            } else {
              latestRef.current.onSelect?.(next.annotationId);
            }
          }
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
      window.addEventListener("keydown", syncAdditiveHeld, true);
      window.addEventListener("keyup", syncAdditiveHeld, true);
      window.addEventListener("mousemove", syncAdditiveHeld, true);
      window.addEventListener("mouseup", onWindowMouseUp, true);
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
          window.removeEventListener("keydown", syncAdditiveHeld, true);
          window.removeEventListener("keyup", syncAdditiveHeld, true);
          window.removeEventListener("mousemove", syncAdditiveHeld, true);
          window.removeEventListener("mouseup", onWindowMouseUp, true);
          window.removeEventListener("contextmenu", onContextMenu, true);
          canvas.removeEventListener("pointermove", onCanvasMove, true);
          map
            .getCanvas()
            .removeEventListener("contextmenu", onContextMenu, true);
          restoreBoxZoom();
          map.dragPan.enable();
          marqueeRef.current = null;
          setMarquee(null);
          setPointerCursor(null);
          setMapCursor(map, "");
          setTracePreview(null);
        } catch {
          window.removeEventListener("keydown", syncAdditiveHeld, true);
          window.removeEventListener("keyup", syncAdditiveHeld, true);
          window.removeEventListener("mousemove", syncAdditiveHeld, true);
          window.removeEventListener("mouseup", onWindowMouseUp, true);
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
    marquee,
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
