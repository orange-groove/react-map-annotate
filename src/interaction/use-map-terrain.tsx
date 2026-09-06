import * as React from "react";
import { SOURCE_IDS } from "../core/constants";
import type { TerrainSourceOptions } from "../core/types";
import { useMapGl } from "../engines/kit/context";
import type { MapRef } from "../engines/kit/types";
import { resolveTerrainSource } from "../engines/mapbox/terrain";

export function useMapTerrain({
  enableTerrain,
  terrainSource,
  resolveMap,
}: {
  enableTerrain?: boolean;
  terrainSource?: TerrainSourceOptions;
  resolveMap: () => MapRef | null;
}) {
  const { Source, engine } = useMapGl();
  const terrain = React.useMemo(
    () => resolveTerrainSource(engine, enableTerrain ?? false, terrainSource),
    [engine, enableTerrain, terrainSource],
  );

  React.useEffect(() => {
    if (!terrain) return;
    const map = resolveMap()?.getMap();
    if (!map) return;

    const applyTerrain = () => {
      if (!map.getSource(SOURCE_IDS.terrain)) return;
      if (map.getTerrain()) return;
      map.setTerrain({
        source: SOURCE_IDS.terrain,
        exaggeration: terrain.exaggeration ?? 1,
      });
    };

    if (map.isStyleLoaded()) applyTerrain();
    map.on("style.load", applyTerrain);
    return () => {
      map.off("style.load", applyTerrain);
    };
  }, [resolveMap, terrain]);

  if (!terrain) return null;
  return (
    <Source
      id={SOURCE_IDS.terrain}
      type="raster-dem"
      url={terrain.url}
      tiles={terrain.tiles}
      tileSize={terrain.tileSize}
      maxzoom={terrain.maxzoom}
    />
  );
}
