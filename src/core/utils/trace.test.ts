import { describe, expect, it, vi } from "vitest";
import type { LngLat, TraceMap } from "../types";
import { destination } from "./geo";
import {
  asTraceFn,
  listTraceLayers,
  resolveTrace,
  sameTracePath,
  splitPathAtJunctions,
  stitchTrace,
  traceRenderedRoads,
} from "./trace";

function mapOf({
  layers = [],
  features = [],
}: {
  layers?: Array<{ id: string; type: string }>;
  features?: Array<{
    geometry?: GeoJSON.Geometry;
    layer?: { id?: string };
    sourceLayer?: string;
    properties?: Record<string, unknown>;
  }>;
} = {}): TraceMap {
  return {
    project: ({ lng, lat }) => ({ x: lng * 1_000_000, y: lat * 1_000_000 }),
    unproject: (point) => {
      const next = Array.isArray(point) ? { x: point[0], y: point[1] } : point;
      return { lng: next.x / 1_000_000, lat: next.y / 1_000_000 };
    },
    getLayer: (id) => layers.find((layer) => layer.id === id) ?? null,
    getStyle: () => ({ layers }),
    queryRenderedFeatures: () => features,
  };
}

const origin: LngLat = [0, 0];
const east10 = destination(origin, 90, 10);
const east20 = destination(origin, 90, 20);
const east40 = destination(origin, 90, 40);
const east80 = destination(origin, 90, 80);
const north10 = destination(origin, 0, 10);

describe("listTraceLayers", () => {
  const layers = [
    { id: "road-street", type: "line" },
    { id: "road_link", type: "line" },
    { id: "building", type: "fill" },
    { id: "rma-line", type: "line" },
    { id: "water", type: "line" },
  ];

  it("keeps rendered road line layers and skips library paint", () => {
    expect(listTraceLayers(mapOf({ layers }))).toEqual([
      "road-street",
      "road_link",
      "building",
    ]);
  });

  it("uses host layer ids when they exist on the map", () => {
    expect(
      listTraceLayers(mapOf({ layers }), ["road-street", "missing", "water"]),
    ).toEqual(["road-street", "water"]);
  });
});

describe("traceRenderedRoads", () => {
  it("returns the closest rendered line", () => {
    const map = mapOf({
      layers: [
        { id: "road-street", type: "line" },
        { id: "highway", type: "line" },
      ],
      features: [
        {
          layer: { id: "highway" },
          properties: { id: "far" },
          geometry: { type: "LineString", coordinates: [north10, [0, 0.002]] },
        },
        {
          layer: { id: "road-street" },
          properties: { id: "near" },
          geometry: { type: "LineString", coordinates: [origin, east20] },
        },
      ],
    });
    const hit = traceRenderedRoads(map, { x: 0, y: 0 });
    expect(hit?.id).toBe("near");
    expect(hit?.coordinates).toEqual([origin, east20]);
  });

  it("reads MultiLineString geometry", () => {
    const map = mapOf({
      layers: [{ id: "road", type: "line" }],
      features: [
        {
          layer: { id: "road" },
          geometry: {
            type: "MultiLineString",
            coordinates: [
              [origin, east10],
              [east20, east40],
            ],
          },
        },
      ],
    });
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual([
      origin,
      east10,
    ]);
  });

  it("returns null when no road layers are present", () => {
    expect(traceRenderedRoads(mapOf(), { x: 0, y: 0 })).toBeNull();
  });

  it("finds a rendered line without consulting the style catalog", () => {
    const map = mapOf({
      features: [
        {
          layer: { id: "road-street" },
          geometry: { type: "LineString", coordinates: [origin, east20] },
        },
      ],
    });
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual([
      origin,
      east20,
    ]);
  });

  it("reads a building outline from a fill polygon", () => {
    const ring: LngLat[] = [
      origin,
      east20,
      destination(east20, 0, 20),
      destination(origin, 0, 20),
      origin,
    ];
    const map = mapOf({
      features: [
        {
          layer: { id: "building" },
          geometry: { type: "Polygon", coordinates: [ring] },
        },
      ],
    });
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual(ring);
  });

  it("ignores line features that are not roads or buildings", () => {
    const map = mapOf({
      features: [
        {
          layer: { id: "admin-boundary" },
          geometry: { type: "LineString", coordinates: [origin, east20] },
        },
      ],
    });
    expect(traceRenderedRoads(map, { x: 0, y: 0 })).toBeNull();
  });

  it("projects with the map as this", () => {
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features: [
        {
          layer: { id: "road-street" },
          geometry: { type: "LineString", coordinates: [origin, east20] },
        },
      ],
    });
    map.project = function project(this: TraceMap, lngLat) {
      if (this !== map) throw new Error("unbound project");
      return { x: lngLat.lng * 1_000_000, y: lngLat.lat * 1_000_000 };
    };
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual([
      origin,
      east20,
    ]);
  });

  it("skips covering landuse and still hits a nearby road", () => {
    const landuse = {
      layer: { id: "landuse_residential" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [-1, -1],
          ],
        ],
      },
    };
    const road = {
      layer: { id: "road-street" },
      geometry: {
        type: "LineString" as const,
        coordinates: [origin, east20],
      },
    };
    const map = mapOf({
      layers: [
        { id: "landuse_residential", type: "fill" },
        { id: "road-street", type: "line" },
      ],
    });
    map.queryRenderedFeatures = (geometry) => {
      const isBox =
        Array.isArray(geometry) &&
        Array.isArray(geometry[0]) &&
        typeof geometry[0][0] === "number";
      return isBox ? [road] : [landuse];
    };
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual([
      origin,
      east20,
    ]);
  });

  it("retries when the first query returns no features", () => {
    const features = [
      {
        layer: { id: "road-street" },
        geometry: {
          type: "LineString" as const,
          coordinates: [origin, east20],
        },
      },
    ];
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
    });
    let calls = 0;
    map.queryRenderedFeatures = () => {
      calls += 1;
      return calls === 1 ? [] : features;
    };
    expect(traceRenderedRoads(map, { x: 0, y: 0 })?.coordinates).toEqual([
      origin,
      east20,
    ]);
  });

  it("retries without a layer filter when the first query throws", () => {
    const features = [
      {
        layer: { id: "road-street" },
        geometry: {
          type: "LineString" as const,
          coordinates: [origin, east20],
        },
      },
    ];
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features,
    });
    map.queryRenderedFeatures = (geometry, options) => {
      if (options?.layers) throw new Error("missing layer");
      return features;
    };
    expect(
      traceRenderedRoads(map, { x: 0, y: 0 }, { layers: ["road-street"] })
        ?.coordinates,
    ).toEqual([origin, east20]);
  });
});

describe("splitPathAtJunctions", () => {
  const avenue: LngLat[] = [origin, east20, east40, east80];
  const crossAt = (at: LngLat): LngLat[] => [
    destination(at, 180, 20),
    at,
    destination(at, 0, 20),
  ];

  it("cuts where another road shares a node and leaves", () => {
    expect(splitPathAtJunctions(avenue, [crossAt(east20)])).toEqual([
      [origin, east20],
      [east20, east40, east80],
    ]);
  });

  it("cuts once per crossroad", () => {
    expect(
      splitPathAtJunctions(avenue, [crossAt(east20), crossAt(east40)]),
    ).toEqual([
      [origin, east20],
      [east20, east40],
      [east40, east80],
    ]);
  });

  it("treats a node a few centimetres off as the same junction", () => {
    const drifted = destination(east20, 90, 0.4);
    expect(splitPathAtJunctions(avenue, [crossAt(drifted)])).toEqual([
      [origin, east20],
      [east20, east40, east80],
    ]);
  });

  it("ignores a copy of the same road clipped at a tile edge", () => {
    expect(splitPathAtJunctions(avenue, [[origin, east20, east40]])).toEqual([
      avenue,
    ]);
  });

  it("leaves a bridge crossing alone when no node is shared", () => {
    const over = destination(east20, 90, 10);
    expect(
      splitPathAtJunctions(avenue, [
        [destination(over, 180, 20), destination(over, 0, 20)],
      ]),
    ).toEqual([avenue]);
  });

  it("does not cut at the ends of the road", () => {
    expect(splitPathAtJunctions(avenue, [crossAt(origin)])).toEqual([avenue]);
  });
});

describe("traceRenderedRoads junction splitting", () => {
  const avenue: LngLat[] = [origin, east20, east40, east80];
  const cross = (at: LngLat, id: string) => ({
    layer: { id: "road-street" },
    properties: { id },
    geometry: {
      type: "LineString" as const,
      coordinates: [destination(at, 180, 20), at, destination(at, 0, 20)],
    },
  });
  const features = [
    {
      layer: { id: "road-street" },
      properties: { id: "avenue" },
      geometry: { type: "LineString" as const, coordinates: avenue },
    },
    cross(east20, "cross-a"),
    cross(east40, "cross-b"),
  ];
  const east30 = destination(origin, 90, 30);

  it("keeps only the block under the cursor", () => {
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features,
    });
    const hit = traceRenderedRoads(map, { x: east30[0] * 1_000_000, y: 0 });
    expect(hit?.coordinates).toEqual([east20, east40]);
  });

  it("gives each block its own id", () => {
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features,
    });
    const first = traceRenderedRoads(map, { x: east10[0] * 1_000_000, y: 0 });
    const second = traceRenderedRoads(map, { x: east30[0] * 1_000_000, y: 0 });
    expect(first?.coordinates).toEqual([origin, east20]);
    expect(first?.id).not.toBe(second?.id);
  });

  it("does not cut at a crosswalk or driveway", () => {
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features: [
        {
          layer: { id: "road-street" },
          properties: { id: "quiet-avenue", class: "secondary" },
          geometry: { type: "LineString" as const, coordinates: avenue },
        },
        {
          ...cross(east20, "crosswalk"),
          properties: { id: "crosswalk", class: "path" },
        },
        {
          ...cross(east40, "driveway"),
          properties: { id: "driveway", class: "service" },
        },
      ],
    });
    const hit = traceRenderedRoads(map, { x: east30[0] * 1_000_000, y: 0 });
    expect(hit?.coordinates).toEqual(avenue);
  });

  it("returns the whole road when splitting is off", () => {
    const map = mapOf({
      layers: [{ id: "road-street", type: "line" }],
      features,
    });
    const hit = traceRenderedRoads(
      map,
      { x: east30[0] * 1_000_000, y: 0 },
      { splitAtJunctions: false },
    );
    expect(hit?.coordinates).toEqual(avenue);
  });
});

describe("resolveTrace", () => {
  it("skips the built-in query when disabled", () => {
    const map = mapOf({
      layers: [{ id: "road", type: "line" }],
      features: [
        {
          geometry: { type: "LineString", coordinates: [origin, east10] },
        },
      ],
    });
    expect(
      resolveTrace(false, origin, {
        map,
        point: { x: 0, y: 0 },
        phase: "hover",
      }),
    ).toBeNull();
  });

  it("uses a host callback", () => {
    const hit = { id: "host", coordinates: [origin, east10] };
    const trace = vi.fn(() => hit);
    expect(
      resolveTrace(trace, origin, {
        map: mapOf(),
        point: { x: 1, y: 2 },
        phase: "draw",
      }),
    ).toBe(hit);
    expect(trace).toHaveBeenCalled();
  });

  it("awaits an async host callback", async () => {
    const hit = { id: "host", coordinates: [origin, east10] };
    await expect(
      resolveTrace(async () => hit, origin, {
        map: mapOf(),
        point: { x: 1, y: 2 },
        phase: "hover",
      }),
    ).resolves.toBe(hit);
  });
});

describe("stitchTrace", () => {
  it("appends a segment that meets the current end", () => {
    expect(stitchTrace([origin, east10], [east10, east20])).toEqual([
      origin,
      east10,
      east20,
    ]);
  });

  it("reverses the next segment when only the far end meets", () => {
    expect(stitchTrace([origin, east10], [east20, east10])).toEqual([
      origin,
      east10,
      east20,
    ]);
  });

  it("prepends a segment that meets the current start", () => {
    expect(stitchTrace([east10, east20], [origin, east10])).toEqual([
      origin,
      east10,
      east20,
    ]);
  });

  it("returns null when the segments are too far apart", () => {
    expect(
      stitchTrace([origin, east10], [east80, destination(east80, 90, 10)]),
    ).toBeNull();
  });

  it("treats reversed copies as the same path", () => {
    expect(
      sameTracePath([origin, east10, east20], [east20, east10, origin]),
    ).toBe(true);
    expect(stitchTrace([origin, east10], [origin, east10])).toEqual([
      origin,
      east10,
    ]);
  });
});

describe("asTraceFn", () => {
  it("wraps options as a function", () => {
    const fn = asTraceFn(false);
    expect(
      fn(origin, { map: mapOf(), point: { x: 0, y: 0 }, phase: "hover" }),
    ).toBeNull();
  });
});
