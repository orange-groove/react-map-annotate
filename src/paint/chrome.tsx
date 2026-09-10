"use client";

import type {
  AnnotateProps,
  Annotation,
  MarkerAnnotation,
  TextAnnotation,
} from "../core/types";
import {
  isAreaAnnotation,
  isTextAnnotation,
  labelAnchor,
} from "../core/utils/annotations";
import { idIsSelected, editHandleAnnotationId } from "../core/utils/selection";
import { visibleAnnotations, type ArrowMarker } from "../core/utils/features";
import { useMapGl } from "../engines/kit/context";
import { useOptionalAnnotate } from "../session/annotate-context";
import { AnnotationLabel } from "./annotation-label";
import { AnnotationMarker } from "./annotation-marker";
import { AnnotationText } from "./annotation-text";
import { DefaultArrowHead } from "./arrow-head";
import { DraftVertices, EditHandles } from "./edit-handles";

export function AnnotateChrome({
  annotations: annotationsProp,
  draft,
  selectedId,
  selectedIds: selectedIdsProp,
  hoveredId,
  color,
  labelsEditable,
  showLabels = true,
  showArea = true,
  renderArrowHead,
  renderLabel,
  arrows,
  markers,
  onSelect,
  onLabelChange,
  onUpdate,
  onHandleDragEnd,
}: Pick<
  AnnotateProps,
  | "annotations"
  | "draft"
  | "selectedId"
  | "selectedIds"
  | "labelsEditable"
  | "showLabels"
  | "showArea"
  | "renderArrowHead"
  | "renderLabel"
  | "onSelect"
  | "onLabelChange"
  | "onUpdate"
> & {
  hoveredId?: string | null;
  color: string;
  arrows: ArrowMarker[];
  markers: MarkerAnnotation[];
  onHandleDragEnd?: (id: string) => void;
}) {
  const { Marker } = useMapGl();
  const session = useOptionalAnnotate();
  const annotations = visibleAnnotations(annotationsProp ?? []);
  const selectedIds = selectedIdsProp ?? session?.selectedIds;
  const handleId = editHandleAnnotationId(annotations, {
    draft,
    selectedIds,
    hoveredId,
    selectedId,
  });

  return (
    <>
      {arrows.map((arrow) => (
        <Marker
          key={`${arrow.id}-${arrow.direction}`}
          longitude={arrow.coordinate[0]}
          latitude={arrow.coordinate[1]}
          anchor="center"
          rotationAlignment="map"
          pitchAlignment="map"
        >
          {(renderArrowHead ?? DefaultArrowHead)({
            direction: arrow.direction,
            bearing: arrow.bearing,
            color: arrow.color,
            selected: arrow.selected,
            size: arrow.size,
          })}
        </Marker>
      ))}

      {markers.map((annotation) => (
        <AnnotationMarker
          key={`marker-${annotation.id}`}
          annotation={annotation}
          selected={idIsSelected(annotation.id, selectedIds, selectedId)}
          color={color}
          annotations={annotations ?? []}
          selectedIds={selectedIds ?? []}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onUpdateMany={session?.onUpdateMany}
          onDragEnd={onHandleDragEnd}
        />
      ))}

      {(annotations ?? [])
        .filter((annotation): annotation is TextAnnotation =>
          isTextAnnotation(annotation),
        )
        .map((annotation) => (
          <AnnotationText
            key={`text-${annotation.id}`}
            annotation={annotation}
            selected={idIsSelected(annotation.id, selectedIds, selectedId)}
            active={handleId === annotation.id}
            color={color}
            editable={labelsEditable ?? true}
            annotations={annotations ?? []}
            selectedIds={selectedIds ?? []}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onUpdateMany={session?.onUpdateMany}
            onDragEnd={onHandleDragEnd}
            onLabelChange={onLabelChange}
          />
        ))}

      {draft?.kind === "polygon" ? (
        <DraftVertices coordinates={draft.coordinates} />
      ) : null}

      <EditHandles
        annotations={annotations}
        activeId={handleId}
        onUpdate={onUpdate}
        onDragEnd={onHandleDragEnd}
      />

      {(annotations ?? []).map((annotation: Annotation) => {
        if (isTextAnnotation(annotation)) return null;
        if (!showLabels && !(showArea && isAreaAnnotation(annotation))) {
          return null;
        }
        const anchor = labelAnchor(annotation);
        if (!anchor) return null;
        const centered = isAreaAnnotation(annotation);
        return (
          <AnnotationLabel
            key={`label-${annotation.id}`}
            annotation={annotation}
            longitude={anchor[0]}
            latitude={anchor[1]}
            selected={idIsSelected(annotation.id, selectedIds, selectedId)}
            editable={labelsEditable ?? true}
            showLabel={showLabels}
            showArea={showArea}
            markerAnchor={centered ? "center" : "bottom"}
            offset={
              annotation.kind === "marker"
                ? [0, -56]
                : centered
                  ? [0, 0]
                  : [0, -8]
            }
            annotations={annotations}
            selectedIds={selectedIds ?? []}
            onSelect={onSelect}
            onLabelChange={onLabelChange}
            onUpdate={onUpdate}
            onUpdateMany={session?.onUpdateMany}
            onDragEnd={onHandleDragEnd}
            render={renderLabel}
          />
        );
      })}
    </>
  );
}
