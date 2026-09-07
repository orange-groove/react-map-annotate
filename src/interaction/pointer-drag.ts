import type { PointerEvent as ReactPointerEvent } from "react";
import type { LngLat } from "../core/types";
import {
  clientToLngLat,
  handleInteraction,
  setMapCursor,
  setPointerCursor,
} from "../core/utils/interaction";
import type { MapLike } from "../engines/kit/types";

export interface PointerGrab {
  from: LngLat;
  handle: LngLat;
}

export function startPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  map: MapLike,
  handle: LngLat,
  onDrag: (point: LngLat, grab: PointerGrab) => void,
  onDragEnd?: () => void,
  cursor = "grabbing",
) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  const panWasEnabled = map.dragPan.isEnabled();
  map.dragPan.disable();
  setMapCursor(map, cursor);
  setPointerCursor(cursor);
  const grab: PointerGrab = {
    from: clientToLngLat(map, event.clientX, event.clientY),
    handle,
  };

  const move = (next: PointerEvent) => {
    onDrag(clientToLngLat(map, next.clientX, next.clientY), grab);
  };
  const up = (next: PointerEvent) => {
    move(next);
    handleInteraction.suppressClickUntil = Date.now() + 400;
    if (panWasEnabled) map.dragPan.enable();
    setPointerCursor(null);
    setMapCursor(map, "");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onDragEnd?.();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export const startHandleDrag = startPointerDrag;
