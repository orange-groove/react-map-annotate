import { describe, expect, it } from "vitest";
import { leafletMarkerShift, toLatLngs } from "./path";

describe("toLatLngs", () => {
  it("flips GeoJSON [lng, lat] to Leaflet [lat, lng]", () => {
    expect(
      toLatLngs([
        [-73.9857, 40.7484],
        [-73.98, 40.75],
      ]),
    ).toEqual([
      [40.7484, -73.9857],
      [40.75, -73.98],
    ]);
  });
});

describe("leafletMarkerShift", () => {
  it("centers custom content and drops pins from the tip", () => {
    expect(leafletMarkerShift(40, 40, "center")).toEqual({ x: -20, y: -20 });
    expect(leafletMarkerShift(40, 40, "bottom")).toEqual({ x: -20, y: -40 });
    expect(leafletMarkerShift(27, 40, undefined, true)).toEqual({
      x: -13.5,
      y: -40,
    });
  });
});
