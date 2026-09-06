import { describe, expect, it, vi } from "vitest";
import { getArcgisMapLike } from "./map-like";
import {
  lngLatToWebMercator,
  type ArcgisView,
  type ArcgisViewEvent,
} from "./view";

function fakeArcgisView() {
  const handlers = new Map<string, Set<(event: ArcgisViewEvent) => void>>();
  const watches = new Map<string, Set<() => void>>();
  const container = document.createElement("div");
  const surface = document.createElement("div");
  surface.className = "esri-view-surface";
  container.appendChild(surface);
  let touchPan = true;

  const view = {
    container,
    navigation: {
      get browserTouchPanEnabled() {
        return touchPan;
      },
      set browserTouchPanEnabled(value: boolean) {
        touchPan = value;
      },
    },
    toScreen(geometry: {
      x?: number;
      y?: number;
      longitude?: number;
      latitude?: number;
      spatialReference?: { wkid?: number };
    }) {
      if (geometry.spatialReference?.wkid === 3857) {
        return { x: geometry.x ?? 0, y: geometry.y ?? 0 };
      }
      if (geometry.longitude != null && geometry.latitude != null) {
        return {
          x: geometry.longitude * 10,
          y: geometry.latitude * 10,
        };
      }
      throw Object.assign(new Error("projecting input geometry failed"), {
        name: "mapview:projection-not-possible",
      });
    },
    toMap({ x, y }: { x: number; y: number }) {
      return {
        longitude: x / 10,
        latitude: y / 10,
      };
    },
    on(type: string, handler: (event: ArcgisViewEvent) => void) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
      return {
        remove() {
          set.delete(handler);
        },
      };
    },
    watch(path: string, handler: () => void) {
      const set = watches.get(path) ?? new Set();
      set.add(handler);
      watches.set(path, set);
      return {
        remove() {
          set.delete(handler);
        },
      };
    },
    emit(type: string, event: ArcgisViewEvent) {
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
    notify(path: string) {
      for (const handler of watches.get(path) ?? []) handler();
    },
  };

  return view;
}

describe("getArcgisMapLike", () => {
  it("projects GeoJSON lng/lat through MapView screen points", () => {
    const view = fakeArcgisView();
    const like = getArcgisMapLike(view as unknown as ArcgisView);
    expect(like.project({ lng: -73.9, lat: 40.7 })).toEqual(
      lngLatToWebMercator(-73.9, 40.7),
    );
    expect(like.unproject([-739, 407])).toEqual({
      lng: -73.9,
      lat: 40.7,
    });
    expect(like.getCanvas()).toBe(view.container);
    expect(like.queryRenderedFeatures({ x: 0, y: 0 })).toEqual([]);
  });

  it("forwards pointer events and can disable drag", () => {
    const view = fakeArcgisView();
    const like = getArcgisMapLike(view as unknown as ArcgisView);
    const listener = vi.fn();
    like.on("mousedown", listener);
    view.emit("pointer-down", {
      x: 12,
      y: 8,
      mapPoint: { longitude: -73.9, latitude: 40.7 },
      native: new MouseEvent("mousedown"),
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        point: { x: 12, y: 8 },
        lngLat: { lng: -73.9, lat: 40.7 },
      }),
    );
    like.dragPan.disable();
    expect(like.dragPan.isEnabled()).toBe(false);
    expect(view.navigation.browserTouchPanEnabled).toBe(false);
    like.off("mousedown", listener);
    view.emit("pointer-down", {
      x: 0,
      y: 0,
      mapPoint: { longitude: 0, latitude: 0 },
      native: new MouseEvent("mousedown"),
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("creates an overlay host on the view container", () => {
    const view = fakeArcgisView();
    const like = getArcgisMapLike(view as unknown as ArcgisView);
    const host = like.getOverlayHost?.();
    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.className).toBe("rmga-arcgis-overlay");
    expect(view.container.querySelector(".rmga-arcgis-overlay")).toBe(host);
    expect(host?.parentElement).toBe(view.container);
  });

  it("keeps getCanvas usable after the view container is cleared", () => {
    const view = fakeArcgisView() as unknown as ArcgisView;
    const like = getArcgisMapLike(view);
    const canvas = like.getCanvas();
    view.container = null;
    expect(like.getCanvas()).toBe(canvas);
    expect(() => {
      like.dragPan.enable();
      like.off("mousedown", vi.fn());
    }).not.toThrow();
  });

  it("notifies overlay subscribers when the viewpoint changes", () => {
    const view = fakeArcgisView();
    const like = getArcgisMapLike(view as unknown as ArcgisView);
    const listener = vi.fn();
    const unsubscribe = like.subscribeRender?.(listener);
    view.notify("extent");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe?.();
    view.notify("extent");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reprojects the overlay while the view is moving", async () => {
    const view = fakeArcgisView() as ReturnType<typeof fakeArcgisView> & {
      updating: boolean;
      scale: number;
    };
    view.updating = false;
    view.scale = 1000;
    const like = getArcgisMapLike(view as unknown as ArcgisView);
    const listener = vi.fn();
    const unsubscribe = like.subscribeRender?.(listener);
    view.updating = true;
    view.scale = 2000;
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalled();
    });
    unsubscribe?.();
  });
});
