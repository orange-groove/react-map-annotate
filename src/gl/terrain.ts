import { MAPBOX_TERRAIN_DEM } from "../constants";
import type { TerrainSourceOptions } from "../types";
import type { MapEngine } from "./types";

export function resolveTerrainSource(
  engine: MapEngine,
  enableTerrain: boolean,
  terrainSource?: TerrainSourceOptions,
): TerrainSourceOptions | null {
  if (!enableTerrain) return null;
  if (terrainSource) {
    return {
      tileSize: 514,
      maxzoom: 14,
      exaggeration: 1,
      ...terrainSource,
    };
  }
  if (engine === "mapbox") {
    return {
      url: MAPBOX_TERRAIN_DEM,
      tileSize: 514,
      maxzoom: 14,
      exaggeration: 1,
    };
  }
  return null;
}
