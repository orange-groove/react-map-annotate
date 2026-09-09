"use client";

import {
  DEFAULT_COLOR,
  DEFAULT_LABELS,
  DEFAULT_TOOLBAR_TOOLS,
  TOOL_LABELS,
  toggleAnnotateTool,
} from "../core/constants";
import type {
  AnnotateTool,
  Annotation,
  AnnotationStyle,
  SelectOptions,
} from "../core/types";
import { canPressFinish, cssColorForInput } from "../core/utils/annotations";
import { useAnnotate } from "./use-annotate";

export interface AnnotateToolItem {
  id: AnnotateTool;
  label: string;
  active: boolean;
  select: () => void;
}

export interface AnnotateListItem {
  annotation: Annotation;
  id: string;
  kind: Annotation["kind"];
  kindLabel: string;
  label: string;
  color: string;
  fontFamily?: string;
  isSelected: boolean;
  select: (options?: SelectOptions) => void;
  setLabel: (label: string) => void;
  setColor: (color: string) => void;
  setStyle: (style: AnnotationStyle) => void;
  remove: () => void;
}

export function useAnnotateTools(
  tools: AnnotateTool[] = DEFAULT_TOOLBAR_TOOLS,
) {
  const session = useAnnotate();
  return {
    tool: session.tool,
    setTool: session.setTool,
    items: tools.map((id) => ({
      id,
      label: TOOL_LABELS[id],
      active: session.tool === id,
      select: () => session.setTool(toggleAnnotateTool(session.tool, id)),
    })),
    canFinish: canPressFinish(session.tool, session.draft),
    finish: session.finish,
    selectedId: session.selectedId,
    selectedIds: session.selectedIds,
    groupSelected: session.groupSelected,
    ungroupSelected: session.ungroupSelected,
    canGroup: session.canGroup,
    canUngroup: session.canUngroup,
    deleteSelected: () => session.removeSelected(),
    undo: session.undo,
    redo: session.redo,
    canUndo: session.canUndo,
    canRedo: session.canRedo,
  };
}

export function useAnnotateFonts() {
  return useAnnotate().fonts;
}

export function useAnnotateItems(defaultColor = DEFAULT_COLOR) {
  const session = useAnnotate();
  return session.annotations.map((annotation) => ({
    annotation,
    id: annotation.id,
    kind: annotation.kind,
    kindLabel: DEFAULT_LABELS[annotation.kind],
    label: annotation.label,
    caption: annotation.caption,
    visible: annotation.visible !== false,
    data: annotation.data,
    color: cssColorForInput(annotation.style?.color, defaultColor),
    fontFamily: annotation.style?.fontFamily,
    isSelected: session.selectedIds.includes(annotation.id),
    select: (options?: SelectOptions) =>
      session.setSelectedId(annotation.id, options),
    setLabel: (label: string) => session.setLabel(annotation.id, label),
    setColor: (color: string) => session.setColor(annotation.id, color),
    setStyle: (style: AnnotationStyle) =>
      session.setStyle(annotation.id, style),
    remove: () => session.onDelete(annotation.id),
  }));
}
