"use client";

/**
 * OpenStreetMap Trace for the engines with no vector query — Google, Leaflet,
 * and ArcGIS. Opt in by importing it; nothing here runs unless you pass the
 * callback to `<Annotate trace={...} />`.
 */
export {
  createOsmTrace,
  osmWayBlocks,
  metersToPath,
  parseOsmXml,
  parseOverpassJson,
  isOsmRoad,
  isOsmBuilding,
} from "./core/utils/osm-trace";
export type {
  OsmTraceOptions,
  OsmWay,
  OsmTags,
  GeoBBox,
} from "./core/utils/osm-trace";
export type { LngLat, TraceFn, TraceHit, TraceContext } from "./core/types";
