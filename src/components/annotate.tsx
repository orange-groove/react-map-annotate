"use client";

import * as React from "react";
import { useAnnotate } from "../context/annotate-context";
import {
  DEFAULT_COLOR,
  SAMPLE_INTERVAL_METERS,
  SELECTABLE_LAYER_IDS,
  SOURCE_IDS,
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
} from "../constants";
import { useMapGl } from "../gl/context";
import { resolveTerrainSource } from "../gl/terrain";
import type { MapLike, MapPoint, MapPointerEvent } from "../gl/types";
import type { AnnotateProps, Annotation, DraftAnnotation } from "../types";
import {
  annotationFromDraft,
  canFinishDraft,
  committedDraftCoordinates,
  minVerticesForKind,
} from "../utils/annotations";
import {
  applyEditHandle,
  editHandleCursor,
  editHandlesFor,
  hitEditHandle,
  moveAnnotation,
  type EditHandleHit,
} from "../utils/edit";
import { haversineDistance } from "../utils/geo";
import {
  eventLngLat,
  handleInteraction,
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
} from "../utils/interaction";
import { hitTestAnnotations } from "../utils/hit-test";
import { AnnotateLayers } from "./annotate-layers";

function annotationHandleAt(
  map: MapLike,
  point: MapPoint,
  annotation: Annotation | undefined,
) {
  if (!annotation) return null;
  return hitEditHandle((lngLat) => map.project(lngLat), point, annotation);
}

function resolveHandleTarget(
  map: MapLike,
  point: MapPoint,
  items: Annotation[],
  hoverId: string | null,
  bodyId: string | null,
): { annotation: Annotation; handle: EditHandleHit } | null {
  const hover = hoverId ? items.find((item) => item.id === hoverId) : undefined;
  const hoverHandle = annotationHandleAt(map, point, hover);
  if (hover && hoverHandle) {
    return { annotation: hover, handle: hoverHandle };
  }
  if (bodyId && bodyId !== hoverId) {
    const body = items.find((item) => item.id === bodyId);
    const bodyHandle = annotationHandleAt(map, point, body);
    if (body && bodyHandle) {
      return { annotation: body, handle: bodyHandle };
    }
  }
  return null;
}

function hitAnnotationId(
  map: MapLike,
  point: MapPoint,
  annotations: Annotation[],
) {
  const layers = SELECTABLE_LAYER_IDS.filter((id) => Boolean(map.getLayer(id)));
  if (layers.length > 0) {
    const id = map.queryRenderedFeatures(point, { layers })[0]?.properties?.id;
    if (typeof id === "string" && id !== "draft" && !id.startsWith("draft-")) {
      return id;
    }
  }
  return hitTestAnnotations(
    (lngLat) => map.project(lngLat),
    point,
    annotations,
  );
}

export function Annotate({
  annotations: annotationsProp,
  draft: draftProp,
  tool: toolProp,
  selectedId: selectedIdProp,
  defaultColor = DEFAULT_COLOR,
  defaultStrokeWidth,
  sampleIntervalMeters = SAMPLE_INTERVAL_METERS,
  enableTerrain = false,
  terrainSource,
  interactive = true,
  labelsEditable = true,
  renderArrowHead,
  onAdd: onAddProp,
  onUpdate: onUpdateProp,
  onDelete: onDeleteProp,
  onDraftChange: onDraftChangeProp,
  onToolChange: onToolChangeProp,
  onSelect: onSelectProp,
  onLabelChange: onLabelChangeProp,
}: AnnotateProps) {
  const session = useAnnotate();
  const annotations = annotationsProp ?? session.annotations;
  const draft = draftProp ?? session.draft;
  const tool = toolProp ?? session.tool;
  const selectedId = selectedIdProp ?? session.selectedId;
  const { Source, useMap, engine, Layers } = useMapGl();
  const PaintLayers = Layers ?? AnnotateLayers;
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
    start: ReturnType<typeof eventLngLat>;
    original: (typeof annotations)[number];
    handle?: EditHandleHit;
    handleAt?: ReturnType<typeof eventLngLat>;
  } | null>(null);

  const onAdd = onAddProp ?? session.onAdd;
  const onUpdate = onUpdateProp ?? session.onUpdate;
  const onDelete = onDeleteProp ?? session.onDelete;
  const onDraftChange = onDraftChangeProp ?? session.onDraftChange;
  const onToolChange = onToolChangeProp ?? session.onToolChange;
  const onSelect = onSelectProp ?? session.onSelect;
  const onLabelChange = onLabelChangeProp ?? session.onLabelChange;

  const latestRef = React.useRef({
    annotations,
    draft,
    tool,
    selectedId,
    defaultColor,
    sampleIntervalMeters,
    onAdd,
    onUpdate,
    onDelete,
    onDraftChange,
    onToolChange,
    onSelect,
    onLabelChange,
  });
  latestRef.current = {
    annotations,
    draft,
    tool,
    selectedId,
    defaultColor,
    sampleIntervalMeters,
    onAdd,
    onUpdate,
    onDelete,
    onDraftChange,
    onToolChange,
    onSelect,
    onLabelChange,
  };

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
    [resolveMap],
  );

  const finishDrawing = React.useCallback(() => {
    const current = latestRef.current.draft;
    if (canFinishDraft(current)) {
      commitDraft(current);
    } else {
      latestRef.current.onDraftChange?.(null);
    }
    latestRef.current.onToolChange?.("select");
  }, [commitDraft]);

  React.useEffect(() => {
    session.registerFinish(finishDrawing);
    return () => session.registerFinish(null);
  }, [finishDrawing, session]);

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
  }, [commitDraft, interactive, resolveMap, setHoverId, tool]);

  React.useEffect(() => {
    if (!interactive) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const {
        draft: current,
        selectedId: id,
        tool: activeTool,
      } = latestRef.current;
      if (event.key === "Escape") {
        if (current) {
          latestRef.current.onDraftChange?.(null);
          return;
        }
        if (isDrawingTool(activeTool)) {
          latestRef.current.onToolChange?.("select");
          return;
        }
        latestRef.current.onSelect?.(null);
        return;
      }
      if (event.key === "Enter" && canFinishDraft(current)) {
        event.preventDefault();
        finishDrawing();
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && id) {
        event.preventDefault();
        latestRef.current.onDelete?.(id);
        latestRef.current.onSelect?.(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commitDraft, finishDrawing, interactive]);

  const terrain = React.useMemo(
    () => resolveTerrainSource(engine, enableTerrain, terrainSource),
    [engine, enableTerrain, terrainSource],
  );

  React.useEffect(() => {
    if (!terrain) return;
    const map = resolveMap()?.getMap();
    if (!map) return;

    const applyTerrain = () => {
      if (!map.getSource(SOURCE_IDS.terrain)) return;
      if (map.getTerrain()) return;
      map.setTerrain({
        source: SOURCE_IDS.terrain,
        exaggeration: terrain.exaggeration ?? 1,
      });
    };

    if (map.isStyleLoaded()) applyTerrain();
    map.on("style.load", applyTerrain);
    return () => {
      map.off("style.load", applyTerrain);
    };
  }, [resolveMap, terrain]);

  function handleLabelChange(
    id: string,
    label: string,
    annotation: (typeof annotations)[number],
  ) {
    onLabelChange?.(id, label, annotation);
  }

  return (
    <>
      {terrain ? (
        <Source
          id={SOURCE_IDS.terrain}
          type="raster-dem"
          url={terrain.url}
          tiles={terrain.tiles}
          tileSize={terrain.tileSize}
          maxzoom={terrain.maxzoom}
        />
      ) : null}
      <PaintLayers
        annotations={annotations}
        draft={draft}
        selectedId={selectedId}
        hoveredId={hoveredId}
        defaultColor={defaultColor}
        defaultStrokeWidth={defaultStrokeWidth}
        labelsEditable={labelsEditable}
        renderArrowHead={renderArrowHead}
        onSelect={onSelect}
        onLabelChange={handleLabelChange}
        onUpdate={onUpdate}
        onHandleDragEnd={(id) => {
          setHoverId(id);
        }}
      />
    </>
  );
}
