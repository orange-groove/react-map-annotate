import { describe, expect, it, vi } from "vitest";
import { getLeafletMapLike } from "./map-like";

function fakeLeafletMap() {
  const handlers = new Map<string, Set<(event: unknown) => void>>();
  let dragging = true;
  const container = document.createElement("div");
  return {
    latLngToContainerPoint: ([lat, lng]: [number, number]) => ({
      x: lng * 10,
      y: lat * 10,
    }),
    containerPointToLatLng: ([x, y]: [number, number]) => ({
      lng: x / 10,
      lat: y / 10,
    }),
    getContainer: () => container,
    dragging: {
      enable: () => {
        dragging = true;
      },
      disable: () => {
        dragging = false;
      },
      enabled: () => dragging,
    },
    boxZoom: {
      enable: () => undefined,
      disable: () => undefined,
      enabled: () => false,
    },
    on(type: string, handler: (event: unknown) => void) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
    },
    off(type: string, handler: (event: unknown) => void) {
      handlers.get(type)?.delete(handler);
    },
    emit(type: string, event: unknown) {
      for (const handler of handlers.get(type) ?? []) handler(event);
    },
  };
}

describe("getLeafletMapLike", () => {
  it("projects GeoJSON lng/lat through Leaflet container points", () => {
    const map = fakeLeafletMap();
    const like = getLeafletMapLike(map as never);
    expect(like.project({ lng: -73.9, lat: 40.7 })).toEqual({
      x: -739,
      y: 407,
    });
    expect(like.unproject([-739, 407])).toEqual({
      lng: -73.9,
      lat: 40.7,
    });
    expect(like.getCanvas()).toBe(map.getContainer());
    expect(like.queryRenderedFeatures({ x: 0, y: 0 })).toEqual([]);
  });

  it("forwards pointer events and can disable drag", () => {
    const map = fakeLeafletMap();
    const like = getLeafletMapLike(map as never);
    const listener = vi.fn();
    like.on("mousedown", listener);
    map.emit("mousedown", {
      latlng: { lng: -73.9, lat: 40.7 },
      containerPoint: { x: 12, y: 8 },
      originalEvent: new MouseEvent("mousedown"),
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        point: { x: 12, y: 8 },
        lngLat: { lng: -73.9, lat: 40.7 },
      }),
    );
    like.dragPan.disable();
    expect(like.dragPan.isEnabled()).toBe(false);
    like.off("mousedown", listener);
    map.emit("mousedown", {
      latlng: { lng: 0, lat: 0 },
      containerPoint: { x: 0, y: 0 },
      originalEvent: new MouseEvent("mousedown"),
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
