import { SAMPLE_INTERVAL_METERS } from "../constants";
import {
  densifyPath,
  formatDistance,
  formatElevationDelta,
  haversineDistance,
} from "./geo";
import type { ElevationSample, LngLat, Measurement } from "../types";

export type TerrainMap = {
  queryTerrainElevation?: (
    lngLat: { lng: number; lat: number },
    options?: { exaggerated?: boolean },
  ) => number | null | undefined;
};

export function queryGroundElevation(
  map: TerrainMap | null | undefined,
  coordinate: LngLat,
): number | null {
  if (!map?.queryTerrainElevation) return null;
  try {
    const elevation = map.queryTerrainElevation(
      { lng: coordinate[0], lat: coordinate[1] },
      { exaggerated: false },
    );
    return typeof elevation === "number" && Number.isFinite(elevation)
      ? elevation
      : null;
  } catch {
    return null;
  }
}

export function measurePath(
  coordinates: LngLat[],
  getElevation: (coordinate: LngLat) => number | null = () => null,
  intervalMeters = SAMPLE_INTERVAL_METERS,
): Measurement {
  const sampled = densifyPath(coordinates, intervalMeters);
  const samples: ElevationSample[] = [];
  let distanceMeters = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let minElevationMeters: number | null = null;
  let maxElevationMeters: number | null = null;
  let previous: LngLat | null = null;
  let previousElevation: number | null = null;

  for (const coordinate of sampled) {
    if (previous) {
      distanceMeters += haversineDistance(previous, coordinate);
    }
    const elevationMeters = getElevation(coordinate);
    if (elevationMeters != null) {
      minElevationMeters =
        minElevationMeters == null
          ? elevationMeters
          : Math.min(minElevationMeters, elevationMeters);
      maxElevationMeters =
        maxElevationMeters == null
          ? elevationMeters
          : Math.max(maxElevationMeters, elevationMeters);
      if (previousElevation != null) {
        const delta = elevationMeters - previousElevation;
        if (delta > 0) elevationGainMeters += delta;
        else elevationLossMeters -= delta;
      }
      previousElevation = elevationMeters;
    }
    samples.push({
      coordinate,
      distanceAlongMeters: distanceMeters,
      elevationMeters,
    });
    previous = coordinate;
  }

  return {
    distanceMeters,
    samples,
    elevationGainMeters,
    elevationLossMeters,
    minElevationMeters,
    maxElevationMeters,
  };
}

export function formatMeasurement(measurement: Measurement): string {
  const distance = formatDistance(measurement.distanceMeters);
  const hasElevation =
    measurement.minElevationMeters != null ||
    measurement.elevationGainMeters > 0 ||
    measurement.elevationLossMeters > 0;
  if (!hasElevation) return distance;
  const gain = formatElevationDelta(measurement.elevationGainMeters);
  const loss = formatElevationDelta(-measurement.elevationLossMeters);
  return `${distance} · ${gain} / ${loss}`;
}
