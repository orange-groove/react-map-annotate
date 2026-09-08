"use client";

import { createPortal } from "react-dom";
import { useMapGl } from "../engines/kit/context";
import type { ScreenRect } from "../core/utils/hit-test";

export function SelectionMarquee({ rect }: { rect: ScreenRect | null }) {
  const { useMap } = useMapGl();
  const maps = useMap();
  if (!rect || (rect.width < 1 && rect.height < 1)) return null;
  const map = maps.current?.getMap();
  const canvas = map?.getCanvas();
  const host =
    map?.getOverlayHost?.() ??
    (canvas instanceof HTMLCanvasElement ? canvas.parentElement : canvas) ??
    canvas;
  if (!host) return null;
  return createPortal(
    <div
      className="rma-marquee"
      data-rma-marquee=""
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />,
    host,
  );
}
