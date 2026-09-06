"use client";

import { useOptionalAnnotate } from "../session/annotate-context";
import { DEFAULT_TOOLBAR_TOOLS, TOOL_LABELS } from "../core/constants";
import type { AnnotateToolbarProps } from "../core/types";
import { canPressFinish } from "../core/utils/annotations";
import { AnnotateToolIcon } from "./tool-icon";

export function AnnotateToolbar({
  tool: toolProp,
  onToolChange: onToolChangeProp,
  selectedId: selectedIdProp,
  onDeleteSelected: onDeleteSelectedProp,
  onFinish: onFinishProp,
  canFinish: canFinishProp,
  orientation = "vertical",
  tools = DEFAULT_TOOLBAR_TOOLS,
  className,
  style,
}: AnnotateToolbarProps) {
  const session = useOptionalAnnotate();
  const tool = toolProp ?? session?.tool ?? "select";
  const selectedId = selectedIdProp ?? session?.selectedId ?? null;
  const onToolChange =
    onToolChangeProp ?? session?.setTool ?? (() => undefined);
  const onFinish = onFinishProp ?? session?.finish ?? (() => undefined);
  const canFinish =
    canFinishProp ?? canPressFinish(tool, session?.draft ?? null);
  const onDeleteSelected =
    onDeleteSelectedProp ??
    (session
      ? () => {
          if (selectedId) session.onDelete(selectedId);
        }
      : undefined);
  return (
    <div
      className={["rmga-toolbar", `rmga-toolbar--${orientation}`, className]
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
            className={`rmga-tool${active ? " rmga-tool--active" : ""}`}
            aria-label={TOOL_LABELS[item]}
            aria-pressed={active}
            title={TOOL_LABELS[item]}
            onClick={() => onToolChange(item)}
          >
            <AnnotateToolIcon tool={item} />
          </button>
        );
      })}
      <button
        type="button"
        className="rmga-tool"
        aria-label="Finish drawing"
        title="Finish"
        disabled={!canFinish}
        onClick={onFinish}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="8.25" />
          <path d="M8.2 12.2 L10.8 14.8 L16.1 9.3" />
        </svg>
      </button>
      {onDeleteSelected ? (
        <button
          type="button"
          className="rmga-tool rmga-tool--danger"
          aria-label="Delete selected annotation"
          title="Delete selected"
          disabled={!selectedId}
          onClick={onDeleteSelected}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M5 7 H19" />
            <path d="M9 7 V5 H15 V7" />
            <path d="M8 7 L9 19 H15 L16 7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
