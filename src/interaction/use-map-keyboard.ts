import * as React from "react";
import { isDrawingTool } from "../core/constants";
import { canFinishDraft } from "../core/utils/annotations";
import type { MapDrawingLatest } from "./use-map-drawing";

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
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const {
        draft: current,
        selectedId: id,
        tool: activeTool,
      } = latestRef.current;
      if (event.key === "Escape") {
        if (current) {
          latestRef.current.onDraftChange?.(null);
          return;
        }
        if (isDrawingTool(activeTool)) {
          latestRef.current.onToolChange?.("select");
          return;
        }
        latestRef.current.onSelect?.(null);
        return;
      }
      if (event.key === "Enter" && canFinishDraft(current)) {
        event.preventDefault();
        finishDrawing();
        return;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && id) {
        event.preventDefault();
        latestRef.current.onDelete?.(id);
        latestRef.current.onSelect?.(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishDrawing, interactive, latestRef]);
}
