import { describe, expect, it } from "vitest";
import { MAPBOX_TERRAIN_DEM } from "../constants";
import { resolveTerrainSource } from "./terrain";

describe("resolveTerrainSource", () => {
  it("returns nothing when terrain is off", () => {
    expect(resolveTerrainSource("mapbox", false)).toBeNull();
    expect(
      resolveTerrainSource("maplibre", false, {
        tiles: ["https://example/{z}/{x}/{y}.png"],
      }),
    ).toBeNull();
  });

  it("uses the Mapbox DEM by default", () => {
    expect(resolveTerrainSource("mapbox", true)).toEqual({
      url: MAPBOX_TERRAIN_DEM,
      tileSize: 514,
      maxzoom: 14,
      exaggeration: 1,
    });
  });

  it("does not invent a MapLibre, Leaflet, Google, or ArcGIS DEM", () => {
    expect(resolveTerrainSource("maplibre", true)).toBeNull();
    expect(resolveTerrainSource("leaflet", true)).toBeNull();
    expect(resolveTerrainSource("google", true)).toBeNull();
    expect(resolveTerrainSource("arcgis", true)).toBeNull();
  });

  it("keeps an explicit source on either engine", () => {
    expect(
      resolveTerrainSource("maplibre", true, {
        tiles: ["https://tiles.example/{z}/{x}/{y}.png"],
        exaggeration: 1.4,
      }),
    ).toEqual({
      tiles: ["https://tiles.example/{z}/{x}/{y}.png"],
      tileSize: 514,
      maxzoom: 14,
      exaggeration: 1.4,
    });
  });
});
