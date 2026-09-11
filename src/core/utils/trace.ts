import {
  LAYER_PREFIX,
  TRACE_JUNCTION_METERS,
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
const MINOR_ROAD =
  /path|footway|sidewalk|crossing|cycle|steps|track|service|driveway|alley|ferry|rail|pier|platform|construction|proposed/;

type TraceFeature = ReturnType<TraceMap["queryRenderedFeatures"]>[number];

/** Roughly 2m of longitude at the equator; the junction lookup grid. */
const JUNCTION_CELL_DEG = 2e-5;
const SPLIT_CACHE_LIMIT = 128;
const splitCache = new Map<string, LngLat[][]>();

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

interface TraceCandidate {
  hit: TraceHit;
  feature: TraceFeature;
}

function pickTraceHit(
  map: TraceMap,
  point: MapPoint,
  features: TraceFeature[],
  tolerance: number,
): TraceCandidate | null {
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
  return {
    hit: { id, coordinates: best.coordinates },
    feature: best.feature,
  };
}

/**
 * Vector tiles hand back a whole road feature, which runs for many blocks. OSM
 * puts a shared node wherever two roads meet at grade, so the crossroads are
 * already in the geometry: a vertex of this road that another road also owns.
 * Cutting there keeps bridges and tunnels whole, since they cross without
 * sharing a node.
 */
export function splitPathAtJunctions(
  path: LngLat[],
  others: LngLat[][],
  toleranceMeters = TRACE_JUNCTION_METERS,
): LngLat[][] {
  if (path.length < 3) return [path.slice()];
  const grid = buildVertexGrid(path);
  const matchIndex = (point: LngLat) =>
    findVertexIndex(grid, path, point, toleranceMeters);
  const cuts = new Set<number>();
  for (const other of others) {
    if (other.length < 2) continue;
    for (let index = 0; index < other.length; index += 1) {
      const at = matchIndex(other[index]);
      if (at <= 0 || at >= path.length - 1) continue;
      // A second copy of this same road, clipped at a tile edge, touches along
      // its length. A crossroad touches at one node and leaves.
      const neighbours: number[] = [];
      if (index > 0) neighbours.push(matchIndex(other[index - 1]));
      if (index < other.length - 1)
        neighbours.push(matchIndex(other[index + 1]));
      if (neighbours.some((neighbour) => neighbour < 0)) cuts.add(at);
    }
  }
  if (cuts.size === 0) return [path.slice()];
  const bounds = [0, ...[...cuts].sort((a, b) => a - b), path.length - 1];
  const parts: LngLat[][] = [];
  for (let index = 1; index < bounds.length; index += 1) {
    const part = path.slice(bounds[index - 1], bounds[index] + 1);
    if (part.length >= 2) parts.push(part);
  }
  return parts;
}

function buildVertexGrid(path: LngLat[]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  for (let index = 0; index < path.length; index += 1) {
    const key = cellKey(path[index]);
    const bucket = grid.get(key);
    if (bucket) bucket.push(index);
    else grid.set(key, [index]);
  }
  return grid;
}

function cellKey([lng, lat]: LngLat): string {
  return `${Math.round(lng / JUNCTION_CELL_DEG)}:${Math.round(lat / JUNCTION_CELL_DEG)}`;
}

function findVertexIndex(
  grid: Map<string, number[]>,
  path: LngLat[],
  point: LngLat,
  toleranceMeters: number,
): number {
  const column = Math.round(point[0] / JUNCTION_CELL_DEG);
  const row = Math.round(point[1] / JUNCTION_CELL_DEG);
  let best = -1;
  let bestDistance = toleranceMeters;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (const index of grid.get(`${column + dx}:${row + dy}`) ?? []) {
        const distance = haversineDistance(path[index], point);
        if (distance <= bestDistance) {
          best = index;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

function isClosedPath(coordinates: LngLat[]): boolean {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return (
    coordinates.length >= 4 && first[0] === last[0] && first[1] === last[1]
  );
}

function isRoadPathFeature(feature: TraceFeature): boolean {
  if (!isUsableFeature(feature)) return false;
  const type = feature.geometry?.type;
  if (type !== "LineString" && type !== "MultiLineString") return false;
  return !(
    isBuildingName(feature.layer?.id) || isBuildingName(feature.sourceLayer)
  );
}

/** Mapbox and OpenMapTiles both carry the road class on the feature. */
function roadClass(feature: TraceFeature): string {
  const properties = feature.properties ?? {};
  for (const key of ["class", "highway", "subclass", "type"]) {
    const value = properties[key];
    if (typeof value === "string" && value) return value.toLowerCase();
  }
  return feature.layer?.id?.toLowerCase() ?? "";
}

/**
 * A crosswalk, driveway, or alley meets the street at a node too, and cutting
 * there leaves slivers rather than blocks. Only a road of its own kind, or one
 * as big as the road being traced, counts as a crossroad.
 */
function isCrossroadFeature(
  feature: TraceFeature,
  tracedClass: string,
): boolean {
  if (!isRoadPathFeature(feature)) return false;
  const value = roadClass(feature);
  return !MINOR_ROAD.test(value) || value === tracedClass;
}

function roadPathsAlong(
  map: TraceMap,
  path: LngLat[],
  layers: string[] | undefined,
  tolerance: number,
  tracedClass: string,
): LngLat[][] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of path) {
    const screen = map.project({ lng, lat });
    if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) continue;
    minX = Math.min(minX, screen.x);
    minY = Math.min(minY, screen.y);
    maxX = Math.max(maxX, screen.x);
    maxY = Math.max(maxY, screen.y);
  }
  if (!Number.isFinite(minX)) return [];
  const box: [[number, number], [number, number]] = [
    [minX - tolerance, minY - tolerance],
    [maxX + tolerance, maxY + tolerance],
  ];
  const features = queryUsable(map, box, layers);
  const paths: LngLat[][] = [];
  for (const feature of features) {
    if (!isCrossroadFeature(feature, tracedClass)) continue;
    for (const coordinates of pathsFromGeometry(feature.geometry)) {
      if (coordinates.length >= 2) paths.push(coordinates);
    }
  }
  return paths;
}

function nearestPart(
  map: TraceMap,
  point: MapPoint,
  parts: LngLat[][],
): LngLat[] {
  let best = parts[0];
  let bestDistance = Infinity;
  for (const part of parts) {
    const distance = distanceToLine(
      (lngLat) => map.project(lngLat),
      point,
      part,
    );
    if (distance < bestDistance) {
      best = part;
      bestDistance = distance;
    }
  }
  return best;
}

function splitCacheKey(hit: TraceHit): string {
  const path = hit.coordinates;
  const first = path[0];
  const last = path[path.length - 1];
  return [
    hit.id ?? "",
    path.length,
    first[0].toFixed(6),
    first[1].toFixed(6),
    last[0].toFixed(6),
    last[1].toFixed(6),
  ].join("|");
}

function rememberSplit(key: string, parts: LngLat[][]): void {
  if (splitCache.size >= SPLIT_CACHE_LIMIT) {
    const oldest = splitCache.keys().next().value;
    if (oldest !== undefined) splitCache.delete(oldest);
  }
  splitCache.set(key, parts);
}

function splitTraceHit(
  map: TraceMap,
  point: MapPoint,
  candidate: TraceCandidate,
  layers: string[] | undefined,
  tolerance: number,
  options: TraceOptions,
): TraceHit {
  const hit = candidate.hit;
  const path = hit.coordinates;
  if (path.length < 3 || isClosedPath(path)) return hit;
  const key = splitCacheKey(hit);
  let parts = splitCache.get(key);
  if (!parts) {
    parts = splitPathAtJunctions(
      path,
      roadPathsAlong(
        map,
        path,
        layers,
        tolerance,
        roadClass(candidate.feature),
      ),
      options.junctionToleranceMeters ?? TRACE_JUNCTION_METERS,
    );
    rememberSplit(key, parts);
  }
  if (parts.length < 2) return hit;
  const part = nearestPart(map, point, parts);
  const start = part[0];
  return {
    id: `${hit.id ?? "trace"}@${start[0].toFixed(5)},${start[1].toFixed(5)}`,
    coordinates: part,
  };
}

export function traceRenderedRoads(
  map: TraceMap,
  point: MapPoint,
  options: TraceOptions = {},
): TraceHit | null {
  const screen = { x: point.x, y: point.y };
  const tolerance = options.pixelTolerance ?? TRACE_PIXEL_TOLERANCE;
  const layers = listTraceLayers(map, options.layers);
  const filter = layers.length ? layers : undefined;
  const features = queryAtPoint(map, screen, filter, tolerance);
  const candidate = pickTraceHit(map, screen, features, tolerance * 4);
  if (!candidate) return null;
  if (options.splitAtJunctions === false) return candidate.hit;
  return splitTraceHit(map, screen, candidate, filter, tolerance, options);
}

function isTracePromise(
  value: TraceHit | null | undefined | Promise<TraceHit | null | undefined>,
): value is Promise<TraceHit | null | undefined> {
  return (
    Boolean(value) && typeof (value as Promise<unknown>).then === "function"
  );
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
      if (isTracePromise(hit)) {
        return hit.then(
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
