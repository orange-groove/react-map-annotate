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

function isAnnotationTextEdit(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(".rma-label-input, .rma-text-input, [data-rma-label] input"),
  );
}

function isModLetter(event: KeyboardEvent, letter: string) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  return (
    event.key.toLowerCase() === letter ||
    event.code === `Key${letter.toUpperCase()}`
  );
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
    copySelected,
    duplicateSelected,
    pasteAtPointer,
  }: {
    latest: MapDrawingLatest;
    finishDrawing: () => void;
    copySelected?: () => boolean;
    duplicateSelected?: () => boolean;
    pasteAtPointer?: () => void | Promise<boolean>;
  },
) {
  if (isModLetter(event, "c") && !isAnnotationTextEdit(event.target)) {
    if (copySelected?.()) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  if (isModLetter(event, "d") && !isAnnotationTextEdit(event.target)) {
    if (duplicateSelected?.()) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  if (isModLetter(event, "v") && !isAnnotationTextEdit(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    void pasteAtPointer?.();
    return;
  }
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
  copySelected,
  duplicateSelected,
  pasteAtPointer,
}: {
  interactive: boolean;
  latestRef: React.MutableRefObject<MapDrawingLatest>;
  finishDrawing: () => void;
  copySelected?: () => boolean;
  duplicateSelected?: () => boolean;
  pasteAtPointer?: () => void | Promise<boolean>;
}) {
  React.useEffect(() => {
    if (!interactive) return;

    function onKeyDown(event: KeyboardEvent) {
      handleMapKeyDown(event, {
        latest: latestRef.current,
        finishDrawing,
        copySelected,
        duplicateSelected,
        pasteAtPointer,
      });
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    copySelected,
    duplicateSelected,
    finishDrawing,
    interactive,
    latestRef,
    pasteAtPointer,
  ]);
}
