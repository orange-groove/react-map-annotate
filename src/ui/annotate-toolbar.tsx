"use client";

import { Check, Redo2, Trash2, Undo2 } from "lucide-react";
import { useOptionalAnnotate } from "../session/annotate-context";
import {
  DEFAULT_TOOLBAR_TOOLS,
  IDLE_TOOL,
  TOOL_LABELS,
  toggleAnnotateTool,
} from "../core/constants";
import type { AnnotateToolbarProps } from "../core/types";
import { canPressFinish } from "../core/utils/annotations";
import { AnnotateToolIcon } from "./tool-icon";

export function AnnotateToolbar({
  tool: toolProp,
  onToolChange: onToolChangeProp,
  selectedId: selectedIdProp,
  selectedIds: selectedIdsProp,
  onDeleteSelected: onDeleteSelectedProp,
  onFinish: onFinishProp,
  canFinish: canFinishProp,
  onUndo: onUndoProp,
  onRedo: onRedoProp,
  canUndo: canUndoProp,
  canRedo: canRedoProp,
  orientation = "vertical",
  tools = DEFAULT_TOOLBAR_TOOLS,
  className,
  style,
}: AnnotateToolbarProps) {
  const session = useOptionalAnnotate();
  const tool = toolProp ?? session?.tool ?? IDLE_TOOL;
  const selectedId = selectedIdProp ?? session?.selectedId ?? null;
  const selectedIds = selectedIdsProp ?? session?.selectedIds ?? [];
  const hasSelection = selectedIds.length > 0 || Boolean(selectedId);
  const onToolChange =
    onToolChangeProp ?? session?.setTool ?? (() => undefined);
  const onFinish = onFinishProp ?? session?.finish ?? (() => undefined);
  const canFinish =
    canFinishProp ?? canPressFinish(tool, session?.draft ?? null);
  const onDeleteSelected =
    onDeleteSelectedProp ??
    (session ? () => session.removeSelected() : undefined);
  const onUndo = onUndoProp ?? session?.undo;
  const onRedo = onRedoProp ?? session?.redo;
  const canUndo = canUndoProp ?? session?.canUndo ?? false;
  const canRedo = canRedoProp ?? session?.canRedo ?? false;
  return (
    <div
      className={["rma-toolbar", `rma-toolbar--${orientation}`, className]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role="toolbar"
      aria-label="Map annotation tools"
    >
      {tools.map((item) => {
        const active = item === tool;
        return (
          <button
            key={item}
            type="button"
            className={`rma-tool${active ? " rma-tool--active" : ""}`}
            aria-label={TOOL_LABELS[item]}
            aria-pressed={active}
            title={TOOL_LABELS[item]}
            onClick={() => onToolChange(toggleAnnotateTool(tool, item))}
          >
            <AnnotateToolIcon tool={item} />
          </button>
        );
      })}
      {onUndo ? (
        <button
          type="button"
          className="rma-tool"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={18} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
      {onRedo ? (
        <button
          type="button"
          className="rma-tool"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={18} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="rma-tool"
        aria-label="Finish drawing"
        title="Finish"
        disabled={!canFinish}
        onClick={onFinish}
      >
        <Check size={18} strokeWidth={1.8} aria-hidden />
      </button>
      {onDeleteSelected ? (
        <button
          type="button"
          className="rma-tool rma-tool--danger"
          aria-label="Delete selected annotation"
          title="Delete selected"
          disabled={!hasSelection}
          onClick={onDeleteSelected}
        >
          <Trash2 size={18} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
