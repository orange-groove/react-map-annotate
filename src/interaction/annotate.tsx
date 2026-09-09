"use client";

import * as React from "react";
import type { AnnotateProps } from "../core/types";
import { settleMeasurement } from "../core/utils/annotations";
import { peekAnnotationClipboardItems } from "../core/utils/clipboard";
import { useLiveAnnotations } from "../session/live-edits";
import { useMapGl } from "../engines/kit/context";
import { AnnotateLayers } from "../paint/gl-layers";
import { GroupHoverBounds } from "../paint/group-hover-bounds";
import { SelectionMarquee } from "../paint/marquee";
import { AnnotationContextMenu } from "../ui/annotation-context-menu";
import { useMapDrawing } from "./use-map-drawing";
import { useMapKeyboard } from "./use-map-keyboard";
import { useMapSession } from "./use-map-session";
import { useMapStyleReady } from "./use-map-style-ready";
import { useMapTerrain } from "./use-map-terrain";

export function Annotate({
  enableTerrain = false,
  terrainSource,
  interactive = true,
  labelsEditable = true,
  onStyleReady,
  renderArrowHead,
  renderLabel,
  ...props
}: AnnotateProps) {
  const session = useMapSession(props);
  const { Layers } = useMapGl();
  const PaintLayers = Layers ?? AnnotateLayers;
  // Geometry from an in-flight gesture, painted without a session render.
  const annotations = useLiveAnnotations(session.annotations);
  const latestRef = React.useRef({
    annotations,
    draft: session.draft,
    tool: session.tool,
    selectedId: session.selectedId,
    selectedIds: session.selectedIds,
    defaultColor: session.defaultColor,
    defaultFontFamily: session.defaultFontFamily,
    sampleIntervalMeters: session.sampleIntervalMeters,
    onAdd: session.onAdd,
    onAddMany: session.session.onAddMany,
    onUpdate: session.onUpdate,
    onUpdateMany: session.session.onUpdateMany,
    onDelete: session.onDelete,
    onDraftChange: session.onDraftChange,
    onToolChange: session.onToolChange,
    onSelect: session.onSelect,
    onLabelChange: session.onLabelChange,
    setSelectedIds: session.session.setSelectedIds,
    setSelectedVertexIndex: session.session.setSelectedVertexIndex,
    undo: session.session.undo,
    redo: session.session.redo,
    beginEdit: session.session.beginEdit,
    endEdit: session.session.endEdit,
    removeSelected: session.session.removeSelected,
    groupSelected: session.session.groupSelected,
    ungroupSelected: session.session.ungroupSelected,
    trace: session.trace,
  });
  latestRef.current = {
    annotations,
    draft: session.draft,
    tool: session.tool,
    selectedId: session.selectedId,
    selectedIds: session.selectedIds,
    defaultColor: session.defaultColor,
    defaultFontFamily: session.defaultFontFamily,
    sampleIntervalMeters: session.sampleIntervalMeters,
    onAdd: session.onAdd,
    onAddMany: session.session.onAddMany,
    onUpdate: session.onUpdate,
    onUpdateMany: session.session.onUpdateMany,
    onDelete: session.onDelete,
    onDraftChange: session.onDraftChange,
    onToolChange: session.onToolChange,
    onSelect: session.onSelect,
    onLabelChange: session.onLabelChange,
    setSelectedIds: session.session.setSelectedIds,
    setSelectedVertexIndex: session.session.setSelectedVertexIndex,
    undo: session.session.undo,
    redo: session.session.redo,
    beginEdit: session.session.beginEdit,
    endEdit: session.session.endEdit,
    removeSelected: session.session.removeSelected,
    groupSelected: session.session.groupSelected,
    ungroupSelected: session.session.ungroupSelected,
    trace: session.trace,
  };

  const {
    hoveredId,
    setHoverId,
    resolveMap,
    finishDrawing,
    copySelected,
    duplicateSelected,
    pasteAtPointer,
    contextMenu,
    setContextMenu,
    tracePreview,
    marquee,
  } = useMapDrawing({
    interactive,
    latestRef,
    tool: session.tool,
  });

  React.useEffect(() => {
    session.session.registerFinish(finishDrawing);
    return () => session.session.registerFinish(null);
  }, [finishDrawing, session.session]);

  const { registerCommitTransform } = session.session;
  const sampleIntervalMeters = session.sampleIntervalMeters;
  React.useEffect(() => {
    registerCommitTransform((items) =>
      items.map((item) =>
        settleMeasurement(item, {
          map: resolveMap()?.getMap(),
          sampleIntervalMeters,
        }),
      ),
    );
    return () => registerCommitTransform(null);
  }, [registerCommitTransform, resolveMap, sampleIntervalMeters]);

  useMapKeyboard({
    interactive,
    latestRef,
    finishDrawing,
    copySelected,
    duplicateSelected,
    pasteAtPointer,
  });

  const terrain = useMapTerrain({
    enableTerrain,
    terrainSource,
    resolveMap,
  });

  const styleReady = useMapStyleReady({ resolveMap, onStyleReady });

  const hasSelection = session.selectedIds.length > 0;

  if (!styleReady) return <>{terrain}</>;

  return (
    <>
      {terrain}
      <PaintLayers
        annotations={annotations}
        draft={session.draft}
        selectedId={session.selectedId}
        selectedIds={session.selectedIds}
        hoveredId={hoveredId}
        defaultColor={session.defaultColor}
        defaultStrokeWidth={session.defaultStrokeWidth}
        labelsEditable={labelsEditable}
        showLabels={session.showLabels}
        showArea={session.showArea}
        tracePreview={tracePreview}
        renderArrowHead={renderArrowHead}
        renderLabel={renderLabel}
        onSelect={session.onSelect}
        onLabelChange={session.onLabelChange}
        onUpdate={session.onUpdate}
        onHandleDragEnd={(id: string) => {
          session.session.endEdit();
          setHoverId(id);
        }}
      />
      <GroupHoverBounds
        annotations={annotations}
        hoveredId={hoveredId}
        showLabels={session.showLabels}
        defaultColor={session.defaultColor}
      />
      <SelectionMarquee rect={marquee} />
      {contextMenu ? (
        <AnnotationContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canDuplicate={hasSelection || Boolean(contextMenu.annotationId)}
          canCopy={hasSelection || Boolean(contextMenu.annotationId)}
          canPaste={peekAnnotationClipboardItems().length > 0}
          canDelete={hasSelection || Boolean(contextMenu.annotationId)}
          canGroup={session.session.canGroup}
          canUngroup={session.session.canUngroup}
          onDuplicate={() => {
            duplicateSelected();
            setContextMenu(null);
          }}
          onCopy={() => {
            copySelected();
            setContextMenu(null);
          }}
          onPaste={() => {
            void pasteAtPointer();
            setContextMenu(null);
          }}
          onGroup={() => {
            session.session.groupSelected();
            setContextMenu(null);
          }}
          onUngroup={() => {
            session.session.ungroupSelected();
            setContextMenu(null);
          }}
          onDelete={() => {
            session.session.removeSelected();
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </>
  );
}
