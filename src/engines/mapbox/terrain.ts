import { MAPBOX_TERRAIN_DEM } from "../../core/constants";
import type { TerrainSourceOptions } from "../../core/types";
import type { MapEngine } from "../../core/types";

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
