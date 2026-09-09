import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit, MapLike, MapPointerEvent } from "../engines/kit/types";
import type { MapEngine } from "../core/types";
import { useMapStyleReady } from "./use-map-style-ready";

function createMap(styleLoaded: boolean) {
  const listeners = new Map<string, Array<(event: MapPointerEvent) => void>>();
  const map = {
    isStyleLoaded: () => styleLoaded,
    on: (type: string, listener: (event: MapPointerEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    off: (type: string, listener: (event: MapPointerEvent) => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((item) => item !== listener),
      );
    },
  } as unknown as MapLike;
  return {
    map,
    load: (styleIsLoaded: boolean) => {
      styleLoaded = styleIsLoaded;
      for (const listener of listeners.get("style.load") ?? []) {
        listener({} as MapPointerEvent);
      }
    },
  };
}

function wrapperFor(engine: MapEngine) {
  const kit = {
    engine,
    Source: () => null,
    Layer: () => null,
    Marker: () => null,
    useMap: () => ({ current: null }),
  } as unknown as GlKit;
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MapGlProvider value={kit}>{children}</MapGlProvider>;
  };
}

describe("useMapStyleReady", () => {
  it("waits for the style, then opens the gate and fires onStyleReady once", () => {
    const { map, load } = createMap(false);
    const onStyleReady = vi.fn();
    const { result } = renderHook(
      () =>
        useMapStyleReady({
          resolveMap: () => ({ getMap: () => map }),
          onStyleReady,
        }),
      { wrapper: wrapperFor("mapbox") },
    );

    expect(result.current).toBe(false);
    expect(onStyleReady).not.toHaveBeenCalled();

    act(() => {
      load(true);
    });

    expect(result.current).toBe(true);
    expect(onStyleReady).toHaveBeenCalledTimes(1);

    act(() => {
      load(true);
    });
    expect(onStyleReady).toHaveBeenCalledTimes(1);
  });

  it("opens immediately when the style is already loaded", () => {
    const { map } = createMap(true);
    const { result } = renderHook(
      () => useMapStyleReady({ resolveMap: () => ({ getMap: () => map }) }),
      { wrapper: wrapperFor("maplibre") },
    );
    expect(result.current).toBe(true);
  });

  it("never gates engines that paint through overlays", () => {
    const { result } = renderHook(
      () => useMapStyleReady({ resolveMap: () => null }),
      { wrapper: wrapperFor("google") },
    );
    expect(result.current).toBe(true);
  });
});
