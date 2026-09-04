"use client";

import type { MapMouseEvent } from "mapbox-gl";
import * as React from "react";
import { Source, useMap } from "react-map-gl/mapbox";
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
import type { AnnotateProps, DraftAnnotation } from "../types";
import {
  annotationFromDraft,
  canFinishDraft,
  committedDraftCoordinates,
  minVerticesForKind,
} from "../utils/annotations";
import { moveAnnotation } from "../utils/edit";
import { haversineDistance } from "../utils/geo";
import {
  eventLngLat,
  handleInteraction,
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
} from "../utils/interaction";
import { AnnotateLayers } from "./annotate-layers";

function hitAnnotationId(
  map: MapMouseEvent["target"],
  point: MapMouseEvent["point"],
) {
  const layers = SELECTABLE_LAYER_IDS.filter((id) => Boolean(map.getLayer(id)));
  if (layers.length === 0) return null;
  const id = map.queryRenderedFeatures(point, { layers })[0]?.properties?.id;
  if (typeof id !== "string" || id === "draft" || id.startsWith("draft-")) {
    return null;
  }
  return id;
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
  const maps = useMap();
  const dragRef = React.useRef(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const suppressClickRef = React.useRef(false);
  const ignoreHoverIdRef = React.useRef<string | null>(null);
  const editRef = React.useRef<{
    id: string;
    start: ReturnType<typeof eventLngLat>;
    original: (typeof annotations)[number];
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

      const onMouseDown = (event: MapMouseEvent) => {
        if (event.originalEvent.button !== 0) return;
        if (isUiTarget(event.originalEvent.target)) return;
        const {
          tool: activeTool,
          draft: current,
          annotations: items,
        } = latestRef.current;
        const hitId = current ? null : hitAnnotationId(map, event.point);
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
            setHoveredId(hitId);
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

      const onMouseMove = (event: MapMouseEvent) => {
        const { tool: activeTool, draft: current } = latestRef.current;
        const point = eventLngLat(event);
        const edit = editRef.current;
        if (edit) {
          if (haversineDistance(edit.start, point) > 1) {
            suppressClickRef.current = true;
          }
          latestRef.current.onUpdate?.(
            moveAnnotation(edit.original, edit.start, point),
          );
          map.getCanvas().style.cursor = "grabbing";
          return;
        }
        if (!current) {
          const nextHover = hitAnnotationId(map, event.point);
          if (nextHover && nextHover === ignoreHoverIdRef.current) {
            setHoveredId(null);
            map.getCanvas().style.cursor = isDrawingTool(activeTool)
              ? "crosshair"
              : "";
            return;
          }
          if (!nextHover) ignoreHoverIdRef.current = null;
          setHoveredId(nextHover);
          if (nextHover) {
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

      const onMouseUp = (event: MapMouseEvent) => {
        if (editRef.current) {
          ignoreHoverIdRef.current = editRef.current.id;
          editRef.current = null;
          setHoveredId(null);
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

      const onClick = (event: MapMouseEvent) => {
        if (isUiTarget(event.originalEvent.target)) return;
        if (
          suppressClickRef.current ||
          Date.now() < handleInteraction.suppressClickUntil
        ) {
          suppressClickRef.current = false;
          return;
        }
        const { tool: activeTool, draft: current } = latestRef.current;
        const point = eventLngLat(event);
        const hitId = current ? null : hitAnnotationId(map, event.point);

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

      const onDblClick = (event: MapMouseEvent) => {
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
        map.off("mousedown", onMouseDown);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
        map.dragPan.enable();
        const canvas = map.getCanvas();
        if (canvas) canvas.style.cursor = "";
      };
    };

    attach();

    return () => {
      cancelled = true;
      if (retry != null) window.clearTimeout(retry);
      detach?.();
    };
  }, [commitDraft, interactive, resolveMap, tool]);

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

  React.useEffect(() => {
    if (!enableTerrain) return;
    const map = resolveMap()?.getMap();
    if (!map) return;

    const applyTerrain = () => {
      if (!map.getSource(SOURCE_IDS.terrain)) return;
      if (map.getTerrain()) return;
      map.setTerrain({ source: SOURCE_IDS.terrain, exaggeration: 1 });
    };

    if (map.isStyleLoaded()) applyTerrain();
    map.on("style.load", applyTerrain);
    return () => {
      map.off("style.load", applyTerrain);
    };
  }, [enableTerrain, resolveMap]);

  function handleLabelChange(
    id: string,
    label: string,
    annotation: (typeof annotations)[number],
  ) {
    onLabelChange?.(id, label, annotation);
  }

  return (
    <>
      {enableTerrain ? (
        <Source
          id={SOURCE_IDS.terrain}
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={514}
          maxzoom={14}
        />
      ) : null}
      <AnnotateLayers
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
          ignoreHoverIdRef.current = id;
          setHoveredId(null);
        }}
      />
    </>
  );
}
