import { describe, expect, it, vi } from "vitest";
import { arcgisMarkerAnchor } from "./marker";
import {
  lngLatFromMapPoint,
  lngLatToWebMercator,
  projectLngLatToView,
  screenPointFromEvent,
  screenPointFromGeometry,
} from "./view";

describe("arcgisMarkerAnchor", () => {
  it("uses CSS translations so the named point sits on the lat/lng", () => {
    expect(arcgisMarkerAnchor("center")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-50%",
    });
    expect(arcgisMarkerAnchor("bottom")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-100%",
    });
    expect(arcgisMarkerAnchor(undefined, true)).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-100%",
    });
    expect(arcgisMarkerAnchor("top")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "0%",
    });
  });
});

describe("lngLatFromMapPoint", () => {
  it("prefers geographic getters over projected x/y", () => {
    expect(
      lngLatFromMapPoint({
        longitude: -73.9,
        latitude: 40.7,
        x: 1,
        y: 2,
      }),
    ).toEqual({ lng: -73.9, lat: 40.7 });
    expect(lngLatFromMapPoint({ x: -73.9, y: 40.7 })).toEqual({
      lng: -73.9,
      lat: 40.7,
    });
    expect(lngLatFromMapPoint(null)).toBeNull();
  });
});

describe("projectLngLatToView", () => {
  it("maps lng/lat through the current Web Mercator extent", () => {
    const mercator = lngLatToWebMercator(-73.9, 40.7);
    expect(mercator).not.toBeNull();
    const view = {
      width: 100,
      height: 50,
      extent: {
        xmin: mercator!.x - 50,
        xmax: mercator!.x + 50,
        ymin: mercator!.y - 25,
        ymax: mercator!.y + 25,
      },
      toScreen: () => ({ x: 0, y: 0 }),
      toMap: () => ({ longitude: 0, latitude: 0 }),
      on: () => ({ remove: () => undefined }),
      container: null,
    };
    expect(projectLngLatToView(view, { lng: -73.9, lat: 40.7 })).toEqual({
      x: 50,
      y: 25,
    });
  });
});

describe("lngLatToWebMercator", () => {
  it("maps the equator and origin to 0, 0", () => {
    const origin = lngLatToWebMercator(0, 0);
    expect(origin?.x).toBeCloseTo(0);
    expect(origin?.y).toBeCloseTo(0);
  });

  it("returns nothing for non-finite coordinates", () => {
    expect(lngLatToWebMercator(Number.NaN, 40)).toBeNull();
  });
});

describe("screenPointFromGeometry", () => {
  it("does not throw when MapView cannot project WGS84", () => {
    const toScreen = vi.fn(() => {
      throw Object.assign(new Error("projecting input geometry failed"), {
        name: "mapview:projection-not-possible",
      });
    });
    expect(
      screenPointFromGeometry(toScreen, { lng: -73.9, lat: 40.7 }),
    ).toBeNull();
    expect(toScreen).toHaveBeenCalled();
  });
});

describe("screenPointFromEvent", () => {
  it("requires finite view coordinates", () => {
    expect(screenPointFromEvent({ x: 4, y: 8 })).toEqual({ x: 4, y: 8 });
    expect(screenPointFromEvent({})).toBeNull();
  });
});
