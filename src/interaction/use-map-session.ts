import { DEFAULT_COLOR, SAMPLE_INTERVAL_METERS } from "../core/constants";
import type { AnnotateProps } from "../core/types";
import { useAnnotate } from "../session/annotate-context";

export function useMapSession({
  annotations: annotationsProp,
  draft: draftProp,
  tool: toolProp,
  selectedId: selectedIdProp,
  defaultColor = DEFAULT_COLOR,
  defaultStrokeWidth,
  sampleIntervalMeters = SAMPLE_INTERVAL_METERS,
  onAdd: onAddProp,
  onUpdate: onUpdateProp,
  onDelete: onDeleteProp,
  onDraftChange: onDraftChangeProp,
  onToolChange: onToolChangeProp,
  onSelect: onSelectProp,
  onLabelChange: onLabelChangeProp,
}: AnnotateProps) {
  const session = useAnnotate();
  return {
    session,
    annotations: annotationsProp ?? session.annotations,
    draft: draftProp ?? session.draft,
    tool: toolProp ?? session.tool,
    selectedId: selectedIdProp ?? session.selectedId,
    defaultColor,
    defaultStrokeWidth,
    sampleIntervalMeters,
    onAdd: onAddProp ?? session.onAdd,
    onUpdate: onUpdateProp ?? session.onUpdate,
    onDelete: onDeleteProp ?? session.onDelete,
    onDraftChange: onDraftChangeProp ?? session.onDraftChange,
    onToolChange: onToolChangeProp ?? session.onToolChange,
    onSelect: onSelectProp ?? session.onSelect,
    onLabelChange: onLabelChangeProp ?? session.onLabelChange,
  };
}
