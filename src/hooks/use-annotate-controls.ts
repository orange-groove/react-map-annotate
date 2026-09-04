"use client";

import {
  DEFAULT_COLOR,
  DEFAULT_LABELS,
  DEFAULT_TOOLBAR_TOOLS,
  TOOL_LABELS,
} from "../constants";
import type { AnnotateTool, Annotation } from "../types";
import { canPressFinish, cssColorForInput } from "../utils/annotations";
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
  setLabel: (label: string) => void;
  setColor: (color: string) => void;
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
      select: () => session.setTool(id),
    })),
    canFinish: canPressFinish(session.tool, session.draft),
    finish: session.finish,
    selectedId: session.selectedId,
    deleteSelected: () => {
      if (session.selectedId) session.onDelete(session.selectedId);
    },
  };
}

export function useAnnotateItems(defaultColor = DEFAULT_COLOR) {
  const session = useAnnotate();
  return session.annotations.map((annotation) => ({
    annotation,
    id: annotation.id,
    kind: annotation.kind,
    kindLabel: DEFAULT_LABELS[annotation.kind],
    label: annotation.label,
    color: cssColorForInput(annotation.style?.color, defaultColor),
    setLabel: (label: string) => session.setLabel(annotation.id, label),
    setColor: (color: string) => session.setColor(annotation.id, color),
    remove: () => session.onDelete(annotation.id),
  }));
}
