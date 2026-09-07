import * as React from "react";
import { isDrawingTool } from "../core/constants";
import type { MapDrawingLatest } from "./use-map-drawing";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable;
}

function isFinishKey(event: KeyboardEvent) {
  return (
    event.key === "Enter" ||
    event.code === "Enter" ||
    event.code === "NumpadEnter" ||
    event.key === "Escape"
  );
}

export function handleMapKeyDown(
  event: KeyboardEvent,
  {
    latest,
    finishDrawing,
  }: {
    latest: MapDrawingLatest;
    finishDrawing: () => void;
  },
) {
  if (isTypingTarget(event.target)) return;
  const { draft: current, selectedId: id, tool: activeTool } = latest;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) latest.redo?.();
    else latest.undo?.();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    latest.redo?.();
    return;
  }
  if (isFinishKey(event)) {
    if (current || isDrawingTool(activeTool)) {
      event.preventDefault();
      event.stopPropagation();
      finishDrawing();
    } else if (event.key === "Escape") {
      latest.onSelect?.(null);
    }
    return;
  }
  if ((event.key === "Backspace" || event.key === "Delete") && id) {
    event.preventDefault();
    if (latest.removeSelected) {
      latest.removeSelected();
      return;
    }
    latest.onDelete?.(id);
    latest.onSelect?.(null);
  }
}

export function useMapKeyboard({
  interactive,
  latestRef,
  finishDrawing,
}: {
  interactive: boolean;
  latestRef: React.MutableRefObject<MapDrawingLatest>;
  finishDrawing: () => void;
}) {
  React.useEffect(() => {
    if (!interactive) return;

    function onKeyDown(event: KeyboardEvent) {
      handleMapKeyDown(event, {
        latest: latestRef.current,
        finishDrawing,
      });
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [finishDrawing, interactive, latestRef]);
}
