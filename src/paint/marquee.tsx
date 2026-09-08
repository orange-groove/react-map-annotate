"use client";

import { createPortal } from "react-dom";
import { useMapGl } from "../engines/kit/context";
import type { ScreenRect } from "../core/utils/hit-test";
import type { MapLike } from "../engines/kit/types";

export function marqueeHost(map: MapLike): HTMLElement | null {
  const canvas = map.getCanvas();
  if (canvas instanceof HTMLElement) {
    const viewport = canvas.querySelector<HTMLElement>(".gm-style");
    if (viewport) return viewport;
  }
  return (
    map.getOverlayHost?.() ??
    (canvas instanceof HTMLCanvasElement ? canvas.parentElement : canvas) ??
    (canvas instanceof HTMLElement ? canvas : null)
  );
}

export function SelectionMarquee({ rect }: { rect: ScreenRect | null }) {
  const { useMap } = useMapGl();
  const maps = useMap();
  if (!rect || (rect.width < 1 && rect.height < 1)) return null;
  const map = maps.current?.getMap();
  if (!map) return null;
  const host = marqueeHost(map);
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
