"use client";

import * as React from "react";
import type { AnnotateProps } from "../core/types";
import { useMapGl } from "../engines/kit/context";
import { AnnotateLayers } from "../paint/gl-layers";
import { useMapDrawing } from "./use-map-drawing";
import { useMapKeyboard } from "./use-map-keyboard";
import { useMapSession } from "./use-map-session";
import { useMapTerrain } from "./use-map-terrain";

export function Annotate({
  enableTerrain = false,
  terrainSource,
  interactive = true,
  labelsEditable = true,
  renderArrowHead,
  ...props
}: AnnotateProps) {
  const session = useMapSession(props);
  const { Layers } = useMapGl();
  const PaintLayers = Layers ?? AnnotateLayers;
  const latestRef = React.useRef({
    annotations: session.annotations,
    draft: session.draft,
    tool: session.tool,
    selectedId: session.selectedId,
    defaultColor: session.defaultColor,
    sampleIntervalMeters: session.sampleIntervalMeters,
    onAdd: session.onAdd,
    onUpdate: session.onUpdate,
    onDelete: session.onDelete,
    onDraftChange: session.onDraftChange,
    onToolChange: session.onToolChange,
    onSelect: session.onSelect,
    onLabelChange: session.onLabelChange,
  });
  latestRef.current = {
    annotations: session.annotations,
    draft: session.draft,
    tool: session.tool,
    selectedId: session.selectedId,
    defaultColor: session.defaultColor,
    sampleIntervalMeters: session.sampleIntervalMeters,
    onAdd: session.onAdd,
    onUpdate: session.onUpdate,
    onDelete: session.onDelete,
    onDraftChange: session.onDraftChange,
    onToolChange: session.onToolChange,
    onSelect: session.onSelect,
    onLabelChange: session.onLabelChange,
  };

  const { hoveredId, setHoverId, resolveMap, finishDrawing } = useMapDrawing({
    interactive,
    latestRef,
    tool: session.tool,
  });

  React.useEffect(() => {
    session.session.registerFinish(finishDrawing);
    return () => session.session.registerFinish(null);
  }, [finishDrawing, session.session]);

  useMapKeyboard({
    interactive,
    latestRef,
    finishDrawing,
  });

  const terrain = useMapTerrain({
    enableTerrain,
    terrainSource,
    resolveMap,
  });

  return (
    <>
      {terrain}
      <PaintLayers
        annotations={session.annotations}
        draft={session.draft}
        selectedId={session.selectedId}
        hoveredId={hoveredId}
        defaultColor={session.defaultColor}
        defaultStrokeWidth={session.defaultStrokeWidth}
        labelsEditable={labelsEditable}
        renderArrowHead={renderArrowHead}
        onSelect={session.onSelect}
        onLabelChange={session.onLabelChange}
        onUpdate={session.onUpdate}
        onHandleDragEnd={(id: string) => {
          setHoverId(id);
        }}
      />
    </>
  );
}
