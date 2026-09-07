"use client";

import type {
  AnnotateProps,
  Annotation,
  MarkerAnnotation,
  TextAnnotation,
} from "../core/types";
import { isTextAnnotation, labelAnchor } from "../core/utils/annotations";
import type { ArrowMarker } from "../core/utils/features";
import { useMapGl } from "../engines/kit/context";
import { AnnotationLabel } from "./annotation-label";
import { AnnotationMarker } from "./annotation-marker";
import { AnnotationText } from "./annotation-text";
import { DefaultArrowHead } from "./arrow-head";
import { DraftVertices, EditHandles } from "./edit-handles";

export function AnnotateChrome({
  annotations,
  draft,
  selectedId,
  hoveredId,
  color,
  labelsEditable,
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
  | "labelsEditable"
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
  const handleId = draft ? null : (hoveredId ?? selectedId ?? null);

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
          selected={selectedId === annotation.id}
          color={color}
          onSelect={onSelect}
          onUpdate={onUpdate}
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
            selected={selectedId === annotation.id}
            active={selectedId === annotation.id || hoveredId === annotation.id}
            color={color}
            editable={labelsEditable ?? true}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onDragEnd={onHandleDragEnd}
            onLabelChange={onLabelChange}
          />
        ))}

      {draft?.kind === "polygon" ? (
        <DraftVertices coordinates={draft.coordinates} color={color} />
      ) : null}

      <EditHandles
        annotations={annotations ?? []}
        activeId={handleId}
        defaultColor={color}
        onUpdate={onUpdate}
        onDragEnd={onHandleDragEnd}
      />

      {(annotations ?? []).map((annotation: Annotation) => {
        if (isTextAnnotation(annotation)) return null;
        const anchor = labelAnchor(annotation);
        if (!anchor) return null;
        return (
          <AnnotationLabel
            key={`label-${annotation.id}`}
            annotation={annotation}
            longitude={anchor[0]}
            latitude={anchor[1]}
            selected={annotation.id === selectedId}
            editable={labelsEditable ?? true}
            offset={annotation.kind === "marker" ? [0, -56] : [0, -8]}
            onSelect={onSelect}
            onLabelChange={onLabelChange}
            render={renderLabel}
          />
        );
      })}
    </>
  );
}
