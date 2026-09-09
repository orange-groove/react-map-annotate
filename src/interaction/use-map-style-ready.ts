"use client";

import * as React from "react";
import { useMapGl } from "../engines/kit/context";
import type { MapLike, MapRef } from "../engines/kit/types";

// Any of these can be the moment the style finishes. Listening to all of them
// avoids a gate that never opens when one is missed.
const STYLE_EVENTS = ["style.load", "styledata", "load", "idle"] as const;

/**
 * Mapbox and MapLibre drop every source and layer when the style reloads, which
 * `enableTerrain` triggers. Gate the annotate sources on a loaded style so they
 * are never added to a style that is about to be thrown away. Engines that
 * paint through overlays have no style to wait for and are never gated.
 */
export function useMapStyleReady({
  resolveMap,
  onStyleReady,
}: {
  resolveMap: () => MapRef | null;
  onStyleReady?: () => void;
}): boolean {
  const { engine } = useMapGl();
  const gated = engine === "mapbox" || engine === "maplibre";
  const [ready, setReady] = React.useState(!gated);
  const notifiedRef = React.useRef(false);

  React.useEffect(() => {
    if (!gated || ready) return;
    let frame = 0;
    let map: MapLike | null = null;
    const sync = () => {
      if (!map?.isStyleLoaded()) return;
      setReady(true);
    };
    const attach = () => {
      map = resolveMap()?.getMap() ?? null;
      if (!map) {
        frame = requestAnimationFrame(attach);
        return;
      }
      sync();
      for (const event of STYLE_EVENTS) map.on(event, sync);
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      for (const event of STYLE_EVENTS) map?.off(event, sync);
    };
  }, [gated, ready, resolveMap]);

  React.useEffect(() => {
    if (!ready || notifiedRef.current) return;
    notifiedRef.current = true;
    onStyleReady?.();
  }, [onStyleReady, ready]);

  return ready;
}
