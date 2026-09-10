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

export interface PointerDragOptions {
  /**
   * Pixels the pointer must travel before the drag takes over. Under it the
   * gesture stays an ordinary click, which is what keeps double-click to
   * rename working on something that is also a drag handle. Defaults to 0,
   * which engages on pointer-down.
   */
  thresholdPx?: number;
  /** Runs when the drag actually takes over, never on a plain click. */
  onDragStart?: () => void;
}

export function startPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  map: MapLike,
  handle: LngLat,
  onDrag: (point: LngLat, grab: PointerGrab) => void,
  onDragEnd?: () => void,
  cursor = "grabbing",
  { thresholdPx = 0, onDragStart }: PointerDragOptions = {},
) {
  event.stopPropagation();
  const target = event.currentTarget;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;
  const grab: PointerGrab = {
    from: clientToLngLat(map, event.clientX, event.clientY),
    handle,
  };

  let engaged = false;
  let panWasEnabled = false;

  const engage = () => {
    engaged = true;
    target.setPointerCapture?.(pointerId);
    panWasEnabled = map.dragPan.isEnabled();
    map.dragPan.disable();
    setMapCursor(map, cursor);
    setPointerCursor(cursor);
    onDragStart?.();
  };

  if (thresholdPx <= 0) {
    event.preventDefault();
    engage();
  }

  const move = (next: PointerEvent) => {
    if (!engaged) {
      const travelled = Math.hypot(
        next.clientX - startX,
        next.clientY - startY,
      );
      if (travelled < thresholdPx) return;
      engage();
    }
    onDrag(clientToLngLat(map, next.clientX, next.clientY), grab);
  };

  const up = (next: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    // Never crossed the threshold, so this was a click. Leave it alone.
    if (!engaged) return;
    move(next);
    handleInteraction.suppressClickUntil = Date.now() + 400;
    if (panWasEnabled) map.dragPan.enable();
    setPointerCursor(null);
    setMapCursor(map, "");
    onDragEnd?.();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export const startHandleDrag = startPointerDrag;
