import type { LngLat, TraceContext, TraceFn, TraceHit } from "../types";
import { distanceToSegment, pointInRing } from "./hit-test";

export interface GeoBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OsmTags {
  highway?: string;
  building?: string;
  name?: string;
}

export interface OsmWay {
  id: string;
  coordinates: LngLat[];
  /**
   * One key per coordinate, shared between ways that meet there. Real node ids
   * when the source gives them, otherwise the coordinate itself.
   */
  nodes: string[];
  tags: OsmTags;
}

export interface OsmTraceOptions {
  /**
   * Where the ways come from. Defaults to the OpenStreetMap map API, falling
   * back to `overpassEndpoints`. Supply this to read your own service instead.
   */
  loadWays?: (bbox: GeoBBox, signal: AbortSignal) => Promise<OsmWay[]>;
  /** Tried in order when the map API fails. Empty disables the fallback. */
  overpassEndpoints?: string[];
  /** How far from the pointer a road still counts as a hit. Defaults to 36. */
  hitMeters?: number;
  /** Cut roads at their crossroads and return one block. Defaults to true. */
  splitAtJunctions?: boolean;
  /** Trace building outlines as well as roads. Defaults to true. */
  buildings?: boolean;
  /** Request timeout. Defaults to 8000. */
  timeoutMs?: number;
  /**
   * Largest bbox side to request, in degrees. Defaults to 0.012, about 1.3km,
   * which keeps a dense city request to a size a phone can parse.
   */
  maxBBoxDegrees?: number;
  /** Highway values too small to cut a block at. */
  minorHighways?: RegExp;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OSM_MAP_API = "https://api.openstreetmap.org/api/0.6/map";
const SKIP_HIGHWAY =
  /^(no|abandoned|dismantled|disused|proposed|razed|demolished|planned)$/;
/** Meets a street at a node, but is not a crossroad you would cut a block at. */
const MINOR_HIGHWAY =
  /^(path|footway|cycleway|bridleway|steps|corridor|elevator|platform|service|track|construction|raceway)$/;
const METERS_PER_DEGREE = 111_320;
const DEFAULT_HIT_METERS = 36;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BBOX_DEGREES = 0.012;
/** Extra margin around the viewport, per side, as a share of its size. */
const VIEW_PAD_RATIO = 0.3;

export function isOsmRoad(tags: OsmTags): boolean {
  return Boolean(tags.highway) && !SKIP_HIGHWAY.test(tags.highway ?? "");
}

export function isOsmBuilding(tags: OsmTags): boolean {
  return Boolean(tags.building) && tags.building !== "no";
}

export function parseOsmXml(xml: string): OsmWay[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const nodes = new Map<string, LngLat>();
  for (const node of Array.from(doc.getElementsByTagName("node"))) {
    const id = node.getAttribute("id");
    const lat = Number(node.getAttribute("lat"));
    const lng = Number(node.getAttribute("lon"));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    nodes.set(id, [lng, lat]);
  }
  const ways: OsmWay[] = [];
  for (const way of Array.from(doc.getElementsByTagName("way"))) {
    const id = way.getAttribute("id");
    if (!id) continue;
    const tags: OsmTags = {};
    for (const tag of Array.from(way.getElementsByTagName("tag"))) {
      const key = tag.getAttribute("k");
      if (key === "highway" || key === "building" || key === "name") {
        tags[key] = tag.getAttribute("v") ?? "";
      }
    }
    const coordinates: LngLat[] = [];
    const refs: string[] = [];
    for (const nd of Array.from(way.getElementsByTagName("nd"))) {
      const ref = nd.getAttribute("ref");
      const node = ref ? nodes.get(ref) : undefined;
      if (!ref || !node) continue;
      coordinates.push(node);
      refs.push(ref);
    }
    if (coordinates.length >= 2) {
      ways.push({ id: `way/${id}`, coordinates, nodes: refs, tags });
    }
  }
  return ways;
}

export function parseOverpassJson(payload: unknown): OsmWay[] {
  const elements = (
    payload as {
      elements?: Array<{
        type?: string;
        id?: number;
        nodes?: number[];
        tags?: OsmTags;
        geometry?: Array<{ lat?: number; lon?: number }>;
      }>;
    }
  )?.elements;
  const ways: OsmWay[] = [];
  for (const element of elements ?? []) {
    if (element.type !== "way" || element.id == null) continue;
    const coordinates: LngLat[] = [];
    for (const node of element.geometry ?? []) {
      if (Number.isFinite(node.lat) && Number.isFinite(node.lon)) {
        coordinates.push([node.lon as number, node.lat as number]);
      }
    }
    if (coordinates.length < 2) continue;
    // `out geom` alone drops the node ids, so the coordinate stands in.
    const nodes =
      element.nodes?.length === coordinates.length
        ? element.nodes.map(String)
        : coordinates.map(nodeKey);
    ways.push({
      id: `way/${element.id}`,
      coordinates,
      nodes,
      tags: element.tags ?? {},
    });
  }
  return ways;
}

function nodeKey([lng, lat]: LngLat): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

function bboxKey(bbox: GeoBBox): string {
  return [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((value) => value.toFixed(3))
    .join(",");
}

function clampBBox(bbox: GeoBBox, maxDegrees: number): GeoBBox {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  const half = maxDegrees / 2;
  return {
    south: Math.max(bbox.south, lat - half),
    west: Math.max(bbox.west, lng - half),
    north: Math.min(bbox.north, lat + half),
    east: Math.min(bbox.east, lng + half),
  };
}

/**
 * The viewport, so one request covers everything the pointer can reach, plus a
 * margin: a road that leaves the screen meets its next crossroad out there,
 * and without that node it cannot be cut. Every engine adapter can unproject,
 * but a bare `TraceMap` may not know its canvas.
 */
function viewBBox(context: TraceContext, lngLat: LngLat): GeoBBox {
  const canvas = context.map.getCanvas?.();
  const width = canvas?.clientWidth ?? 0;
  const height = canvas?.clientHeight ?? 0;
  if (width > 0 && height > 0) {
    const a = context.map.unproject([0, 0]);
    const b = context.map.unproject([width, height]);
    const south = Math.min(a.lat, b.lat);
    const north = Math.max(a.lat, b.lat);
    const west = Math.min(a.lng, b.lng);
    const east = Math.max(a.lng, b.lng);
    if (Number.isFinite(south) && Number.isFinite(west)) {
      const padLat = (north - south) * VIEW_PAD_RATIO;
      const padLng = (east - west) * VIEW_PAD_RATIO;
      return {
        south: south - padLat,
        west: west - padLng,
        north: north + padLat,
        east: east + padLng,
      };
    }
  }
  const pad = 0.002;
  return {
    south: lngLat[1] - pad,
    west: lngLat[0] - pad,
    north: lngLat[1] + pad,
    east: lngLat[0] + pad,
  };
}

async function requestOsmMapApi(
  bbox: GeoBBox,
  signal: AbortSignal,
): Promise<OsmWay[]> {
  const box = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  const response = await fetch(`${OSM_MAP_API}?bbox=${box}`, { signal });
  if (!response.ok) throw new Error(`osm ${response.status}`);
  return parseOsmXml(await response.text());
}

async function requestOverpass(
  endpoints: string[],
  bbox: GeoBBox,
  buildings: boolean,
  signal: AbortSignal,
): Promise<OsmWay[]> {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const data = `[out:json][timeout:12];
(
  way["highway"](${box});${buildings ? `\n  way["building"](${box});` : ""}
);
out body geom;`;
  let last: unknown;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data }),
        signal,
      });
      if (!response.ok) throw new Error(`overpass ${response.status}`);
      return parseOverpassJson(await response.json());
    } catch (error) {
      if (signal.aborted) throw error;
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("overpass unavailable");
}

function toLocal(point: LngLat, origin: LngLat) {
  const cos = Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
  return {
    x: (point[0] - origin[0]) * METERS_PER_DEGREE * cos,
    y: (point[1] - origin[1]) * METERS_PER_DEGREE,
  };
}

function isClosed(coordinates: LngLat[]): boolean {
  if (coordinates.length < 4) return false;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return (
    Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9
  );
}

/** Metres from `point` to the path, or 0 inside a closed ring. */
export function metersToPath(point: LngLat, coordinates: LngLat[]): number {
  const local = coordinates.map((coordinate) => toLocal(coordinate, point));
  if (isClosed(coordinates) && pointInRing({ x: 0, y: 0 }, local)) return 0;
  let min = Infinity;
  for (let index = 1; index < local.length; index += 1) {
    min = Math.min(
      min,
      distanceToSegment({ x: 0, y: 0 }, local[index - 1], local[index]),
    );
  }
  return min;
}

/**
 * A way runs for as many blocks as its tags stay the same, so tracing one
 * paints a whole avenue. Two ways that meet at grade share a node, which is
 * where the way gets cut. A crosswalk, driveway, or alley shares a node too
 * and would leave slivers, so only a road of its own kind, or one as big,
 * counts as a crossroad.
 */
export function osmWayBlocks(
  way: OsmWay,
  ways: Map<string, OsmWay>,
  nodeWays: Map<string, Set<string>>,
  minorHighways = MINOR_HIGHWAY,
): LngLat[][] {
  const coordinates = way.coordinates;
  if (!isOsmRoad(way.tags) || coordinates.length < 3) return [coordinates];
  const isCrossroad = (node: string) => {
    for (const id of nodeWays.get(node) ?? []) {
      if (id === way.id) continue;
      const other = ways.get(id);
      if (!other || !isOsmRoad(other.tags)) continue;
      const highway = other.tags.highway ?? "";
      if (!minorHighways.test(highway) || highway === way.tags.highway) {
        return true;
      }
    }
    return false;
  };
  const parts: LngLat[][] = [];
  let start = 0;
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    if (!isCrossroad(way.nodes[index])) continue;
    parts.push(coordinates.slice(start, index + 1));
    start = index;
  }
  parts.push(coordinates.slice(start));
  const kept = parts.filter((part) => part.length >= 2);
  return kept.length > 0 ? kept : [coordinates];
}

/**
 * A `trace` callback for the engines with no vector query — Google, Leaflet,
 * and ArcGIS. It reads OpenStreetMap for the viewport, keeps what it has read,
 * and returns the road block or building outline under the pointer.
 *
 * OSM data is ODbL: credit OpenStreetMap where the annotations are shown. The
 * default endpoints are shared community services — point `loadWays` or
 * `overpassEndpoints` at your own if you send real traffic. `buildings: false`
 * cuts the payload a long way where you only care about roads.
 */
export function createOsmTrace(options: OsmTraceOptions = {}): TraceFn {
  const hitMeters = options.hitMeters ?? DEFAULT_HIT_METERS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBBox = options.maxBBoxDegrees ?? DEFAULT_MAX_BBOX_DEGREES;
  const buildings = options.buildings !== false;
  const split = options.splitAtJunctions !== false;
  const minorHighways = options.minorHighways ?? MINOR_HIGHWAY;
  const overpass = options.overpassEndpoints ?? OVERPASS_ENDPOINTS;

  const ways = new Map<string, OsmWay>();
  const nodeWays = new Map<string, Set<string>>();
  const blocks = new Map<string, LngLat[][]>();
  const loaded = new Set<string>();
  const inflight = new Map<string, Promise<void>>();

  // Overpass first because it can ask for roads alone. The map API cannot
  // filter, so the same bbox comes back tens of megabytes heavier; it is the
  // fallback for when Overpass is busy, which it often is.
  const loadWays =
    options.loadWays ??
    (async (bbox: GeoBBox, signal: AbortSignal) => {
      if (overpass.length > 0) {
        try {
          return await requestOverpass(overpass, bbox, buildings, signal);
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
      return requestOsmMapApi(bbox, signal);
    });

  const keep = (way: OsmWay) => {
    const road = isOsmRoad(way.tags);
    if (!road && !(buildings && isOsmBuilding(way.tags))) return;
    ways.set(way.id, way);
    if (!road) return;
    for (const node of way.nodes) {
      const at = nodeWays.get(node);
      if (at) at.add(way.id);
      else nodeWays.set(node, new Set([way.id]));
    }
  };

  const load = (bbox: GeoBBox): Promise<void> => {
    const box = clampBBox(bbox, maxBBox);
    const key = bboxKey(box);
    if (loaded.has(key)) return Promise.resolve();
    const pending = inflight.get(key);
    if (pending) return pending;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const next = loadWays(box, controller.signal)
      .then((fetched) => {
        for (const way of fetched) keep(way);
        blocks.clear();
        loaded.add(key);
      })
      .catch(() => {
        // Leave the bbox unloaded so a later hover can try again.
      })
      .finally(() => {
        clearTimeout(timer);
        inflight.delete(key);
      });
    inflight.set(key, next);
    return next;
  };

  const blocksOf = (way: OsmWay): LngLat[][] => {
    if (!split) return [way.coordinates];
    const cached = blocks.get(way.id);
    if (cached) return cached;
    const parts = osmWayBlocks(way, ways, nodeWays, minorHighways);
    blocks.set(way.id, parts);
    return parts;
  };

  const pick = (lngLat: LngLat): TraceHit | null => {
    if (!Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) return null;
    let best: TraceHit | null = null;
    let bestDistance = hitMeters;
    for (const way of ways.values()) {
      if (metersToPath(lngLat, way.coordinates) > hitMeters) continue;
      for (const block of blocksOf(way)) {
        const distance = metersToPath(lngLat, block);
        if (distance > bestDistance) continue;
        bestDistance = distance;
        best = {
          id: `${way.id}@${nodeKey(block[0])}`,
          coordinates: block,
        };
      }
    }
    return best;
  };

  return (lngLat, context) => {
    const hit = pick(lngLat);
    if (hit) {
      void load(viewBBox(context, lngLat));
      return hit;
    }
    return load(viewBBox(context, lngLat)).then(() => pick(lngLat));
  };
}
