import {
  LAYER_PREFIX,
  TRACE_PIXEL_TOLERANCE,
  TRACE_STITCH_METERS,
} from "../constants";
import type {
  LngLat,
  MapPoint,
  TraceContext,
  TraceFn,
  TraceHit,
  TraceMap,
  TraceOption,
  TraceOptions,
} from "../types";
import { haversineDistance } from "./geo";
import { distanceToSegment, pointInRing } from "./hit-test";

const ROAD_LAYER =
  /road|street|highway|motorway|trunk|primary|secondary|tertiary|path|track|bridge|tunnel|rail|cycle|service|minor|motor|transport|aeroway/;
const BUILDING_LAYER = /building|structure/;
const IGNORE_LAYER =
  /water|landcover|landuse|admin|boundar|label|symbol|hillshade|background|sky|place|poi|housenum|park|rma-/;

type TraceFeature = ReturnType<TraceMap["queryRenderedFeatures"]>[number];

export function listTraceLayers(map: TraceMap, layers?: string[]): string[] {
  if (layers?.length) {
    return layers.filter((id) => Boolean(map.getLayer(id)));
  }
  try {
    return (map.getStyle?.()?.layers ?? [])
      .filter((layer) => {
        if (layer.id.startsWith(`${LAYER_PREFIX}-`)) return false;
        if (
          layer.type !== "line" &&
          layer.type !== "fill" &&
          layer.type !== "fill-extrusion"
        ) {
          return false;
        }
        return isTraceName(layer.id);
      })
      .map((layer) => layer.id)
      .filter((id) => Boolean(map.getLayer(id)));
  } catch {
    return [];
  }
}

function isRoadName(value: string | undefined): boolean {
  return Boolean(value && ROAD_LAYER.test(value.toLowerCase()));
}

function isBuildingName(value: string | undefined): boolean {
  return Boolean(value && BUILDING_LAYER.test(value.toLowerCase()));
}

function isTraceName(value: string | undefined): boolean {
  return isRoadName(value) || isBuildingName(value);
}

function isIgnoredName(value: string | undefined): boolean {
  return Boolean(value && IGNORE_LAYER.test(value.toLowerCase()));
}

function isLibraryLayer(id: string | undefined): boolean {
  return Boolean(id?.startsWith(`${LAYER_PREFIX}-`));
}

function isNamedTraceFeature(feature: TraceFeature): boolean {
  if (isLibraryLayer(feature.layer?.id)) return false;
  return isTraceName(feature.layer?.id) || isTraceName(feature.sourceLayer);
}

function isUsableFeature(feature: TraceFeature): boolean {
  if (isLibraryLayer(feature.layer?.id)) return false;
  if (isIgnoredName(feature.layer?.id) || isIgnoredName(feature.sourceLayer)) {
    return false;
  }
  if (isNamedTraceFeature(feature)) return true;
  const type = feature.geometry?.type;
  return (
    type === "LineString" ||
    type === "MultiLineString" ||
    type === "Polygon" ||
    type === "MultiPolygon"
  );
}

function pathsFromGeometry(geometry?: GeoJSON.Geometry): LngLat[][] {
  if (!geometry) return [];
  if (geometry.type === "LineString") {
    return [geometry.coordinates as LngLat[]];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates as LngLat[][];
  }
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0] as LngLat[] | undefined;
    return ring && ring.length >= 2 ? [ring] : [];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => {
      const ring = polygon[0] as LngLat[] | undefined;
      return ring && ring.length >= 2 ? [ring] : [];
    });
  }
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((item) => pathsFromGeometry(item));
  }
  return [];
}

function distanceToLine(
  project: TraceMap["project"],
  point: MapPoint,
  coordinates: LngLat[],
): number {
  const ring = coordinates.map((coordinate) =>
    project({ lng: coordinate[0], lat: coordinate[1] }),
  );
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const closed =
    coordinates.length >= 4 && first[0] === last[0] && first[1] === last[1];
  if (closed && pointInRing(point, ring)) return 0;
  let min = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    min = Math.min(min, distanceToSegment(point, ring[index - 1], ring[index]));
  }
  return min;
}

function queryPoint(point: MapPoint): [number, number] {
  return [point.x, point.y];
}

function queryBox(
  point: MapPoint,
  tolerance: number,
): [[number, number], [number, number]] {
  return [
    [point.x - tolerance, point.y - tolerance],
    [point.x + tolerance, point.y + tolerance],
  ];
}

function collectUsable(features: TraceFeature[]): TraceFeature[] {
  return features.filter(isUsableFeature);
}

function queryUsable(
  map: TraceMap,
  geometry: Parameters<TraceMap["queryRenderedFeatures"]>[0],
  layers?: string[],
): TraceFeature[] {
  try {
    return collectUsable(
      map.queryRenderedFeatures(
        geometry,
        layers?.length ? { layers } : undefined,
      ),
    );
  } catch {
    return [];
  }
}

function queryAtPoint(
  map: TraceMap,
  point: MapPoint,
  layers: string[] | undefined,
  tolerance: number,
): TraceFeature[] {
  const pixel = queryPoint(point);
  const box = queryBox(point, tolerance);
  const attempts: Array<() => TraceFeature[]> = [
    () => queryUsable(map, box, layers),
    () => queryUsable(map, pixel, layers),
    () => queryUsable(map, box),
    () => queryUsable(map, pixel),
    () => queryUsable(map, undefined),
  ];
  for (const attempt of attempts) {
    const features = attempt();
    if (features.length > 0) return features;
  }
  return collectUsable(queryLoadedSources(map));
}

function queryLoadedSources(map: TraceMap): TraceFeature[] {
  if (!map.querySourceFeatures) return [];
  const layers = map.getStyle?.()?.layers ?? [];
  const seen = new Set<string>();
  const features: TraceFeature[] = [];
  for (const layer of layers) {
    if (!isTraceName(layer.id) || isLibraryLayer(layer.id)) continue;
    const spec = map.getLayer(layer.id) as
      | {
          source?: string;
          sourceLayer?: string;
          "source-layer"?: string;
        }
      | null
      | undefined;
    const source = spec?.source;
    const sourceLayer = spec?.sourceLayer ?? spec?.["source-layer"];
    if (!source) continue;
    const key = `${source}:${sourceLayer ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      features.push(
        ...map.querySourceFeatures(
          source,
          sourceLayer ? { sourceLayer } : undefined,
        ),
      );
    } catch {
      // Source layer may not be loaded yet.
    }
  }
  return features;
}

function pickTraceHit(
  map: TraceMap,
  point: MapPoint,
  features: TraceFeature[],
  tolerance: number,
): TraceHit | null {
  const candidates: Array<{
    feature: TraceFeature;
    coordinates: LngLat[];
    distance: number;
    named: boolean;
  }> = [];
  for (const feature of features) {
    if (!isUsableFeature(feature)) continue;
    for (const coordinates of pathsFromGeometry(feature.geometry)) {
      if (coordinates.length < 2) continue;
      const distance = distanceToLine(
        (lngLat) => map.project(lngLat),
        point,
        coordinates,
      );
      if (distance > tolerance) continue;
      candidates.push({
        feature,
        coordinates,
        distance,
        named: isNamedTraceFeature(feature),
      });
    }
  }
  const pool = candidates.some((item) => item.named)
    ? candidates.filter((item) => item.named)
    : candidates;
  let best: (typeof pool)[number] | null = null;
  for (const item of pool) {
    if (!best || item.distance < best.distance) best = item;
  }
  if (!best) return null;
  const id =
    typeof best.feature.properties?.id === "string" ||
    typeof best.feature.properties?.id === "number"
      ? String(best.feature.properties.id)
      : `${best.feature.layer?.id ?? best.feature.sourceLayer ?? "trace"}:${best.coordinates[0][0].toFixed(5)},${best.coordinates[0][1].toFixed(5)}`;
  return { id, coordinates: best.coordinates };
}

export function traceRenderedRoads(
  map: TraceMap,
  point: MapPoint,
  options: TraceOptions = {},
): TraceHit | null {
  const screen = { x: point.x, y: point.y };
  const tolerance = options.pixelTolerance ?? TRACE_PIXEL_TOLERANCE;
  const layers = listTraceLayers(map, options.layers);
  const features = queryAtPoint(
    map,
    screen,
    layers.length ? layers : undefined,
    tolerance,
  );
  return pickTraceHit(map, screen, features, tolerance * 4);
}

export function resolveTrace(
  option: TraceOption | undefined,
  lngLat: LngLat,
  context: TraceContext,
): TraceHit | null | Promise<TraceHit | null> {
  try {
    if (option === false) return null;
    if (typeof option === "function") {
      const hit = option(lngLat, context);
      if (hit && typeof (hit as Promise<unknown>).then === "function") {
        return Promise.resolve(hit).then(
          (value) => value ?? null,
          () => null,
        );
      }
      return hit ?? null;
    }
    const point = context.point;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    const options = option === true || option == null ? {} : option;
    return traceRenderedRoads(context.map, point, options);
  } catch {
    return null;
  }
}

export function stitchTrace(
  current: LngLat[],
  next: LngLat[],
  limitMeters = TRACE_STITCH_METERS,
): LngLat[] | null {
  if (next.length < 2) return null;
  if (current.length < 2) return next.slice();
  if (sameTracePath(current, next)) return current;

  const start = current[0];
  const end = current[current.length - 1];
  const nextStart = next[0];
  const nextEnd = next[next.length - 1];
  const candidates = [
    {
      distance: haversineDistance(end, nextStart),
      result: [...current, ...next.slice(1)],
    },
    {
      distance: haversineDistance(end, nextEnd),
      result: [...current, ...next.slice(0, -1).reverse()],
    },
    {
      distance: haversineDistance(start, nextEnd),
      result: [...next, ...current.slice(1)],
    },
    {
      distance: haversineDistance(start, nextStart),
      result: [...next.slice().reverse(), ...current.slice(1)],
    },
  ];

  let best: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    if (candidate.distance > limitMeters) continue;
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best?.result ?? null;
}

export function sameTracePath(a: LngLat[], b: LngLat[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  return a[0][0] === b[0][0] && a[0][1] === b[0][1]
    ? a[a.length - 1][0] === b[b.length - 1][0] &&
        a[a.length - 1][1] === b[b.length - 1][1]
    : a[0][0] === b[b.length - 1][0] &&
        a[0][1] === b[b.length - 1][1] &&
        a[a.length - 1][0] === b[0][0] &&
        a[a.length - 1][1] === b[0][1];
}

export function asTraceFn(option: TraceOption | undefined): TraceFn {
  return (lngLat, context) => resolveTrace(option, lngLat, context);
}
