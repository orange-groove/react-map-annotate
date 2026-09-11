import { describe, expect, it, vi } from "vitest";
import type { LngLat, TraceContext, TraceMap } from "../types";
import { destination } from "./geo";
import {
  createOsmTrace,
  metersToPath,
  osmWayBlocks,
  parseOsmXml,
  parseOverpassJson,
  type GeoBBox,
  type OsmWay,
} from "./osm-trace";

const origin: LngLat = [0, 0];
const east20 = destination(origin, 90, 20);
const east40 = destination(origin, 90, 40);
const east80 = destination(origin, 90, 80);

function way(
  id: string,
  coordinates: LngLat[],
  nodes: string[],
  tags: OsmWay["tags"],
): OsmWay {
  return { id, coordinates, nodes, tags };
}

function indexOf(ways: OsmWay[]) {
  const byId = new Map(ways.map((item) => [item.id, item]));
  const nodeWays = new Map<string, Set<string>>();
  for (const item of ways) {
    for (const node of item.nodes) {
      const at = nodeWays.get(node);
      if (at) at.add(item.id);
      else nodeWays.set(node, new Set([item.id]));
    }
  }
  return { byId, nodeWays };
}

function contextOf(): TraceContext {
  const map = {
    project: ({ lng, lat }) => ({ x: lng * 1_000_000, y: lat * 1_000_000 }),
    unproject: (point) => {
      const next = Array.isArray(point) ? { x: point[0], y: point[1] } : point;
      return { lng: next.x / 1_000_000, lat: next.y / 1_000_000 };
    },
    getLayer: () => null,
    queryRenderedFeatures: () => [],
  } satisfies TraceMap;
  return { map, point: { x: 0, y: 0 }, phase: "hover" };
}

const avenue = way(
  "way/1",
  [origin, east20, east40, east80],
  ["n0", "n20", "n40", "n80"],
  { highway: "secondary", name: "9th Avenue" },
);

describe("osmWayBlocks", () => {
  it("cuts a way at the nodes it shares with other streets", () => {
    const cross = way(
      "way/2",
      [destination(east20, 180, 20), east20, destination(east20, 0, 20)],
      ["s", "n20", "n"],
      { highway: "residential" },
    );
    const { byId, nodeWays } = indexOf([avenue, cross]);
    expect(osmWayBlocks(avenue, byId, nodeWays)).toEqual([
      [origin, east20],
      [east20, east40, east80],
    ]);
  });

  it("ignores a crosswalk, footpath, or driveway", () => {
    const crossing = way("way/3", [origin, east20], ["x", "n20"], {
      highway: "footway",
    });
    const driveway = way("way/4", [east40, east80], ["n40", "y"], {
      highway: "service",
    });
    const { byId, nodeWays } = indexOf([avenue, crossing, driveway]);
    expect(osmWayBlocks(avenue, byId, nodeWays)).toEqual([avenue.coordinates]);
  });

  it("still cuts a footpath where footpaths meet", () => {
    const path = way("way/5", [origin, east20, east40], ["a", "b", "c"], {
      highway: "footway",
    });
    const other = way(
      "way/6",
      [east20, destination(east20, 0, 20)],
      ["b", "d"],
      {
        highway: "footway",
      },
    );
    const { byId, nodeWays } = indexOf([path, other]);
    expect(osmWayBlocks(path, byId, nodeWays)).toEqual([
      [origin, east20],
      [east20, east40],
    ]);
  });

  it("leaves a building outline whole", () => {
    const ring: LngLat[] = [origin, east20, destination(east20, 0, 20), origin];
    const building = way("way/7", ring, ["a", "b", "c", "a"], {
      building: "yes",
    });
    const { byId, nodeWays } = indexOf([building]);
    expect(osmWayBlocks(building, byId, nodeWays)).toEqual([ring]);
  });
});

describe("parseOsmXml", () => {
  it("reads ways, tags, and node ids", () => {
    const ways = parseOsmXml(`<?xml version="1.0"?>
      <osm>
        <node id="1" lat="0" lon="0" />
        <node id="2" lat="0" lon="0.001" />
        <way id="10">
          <nd ref="1" />
          <nd ref="2" />
          <tag k="highway" v="residential" />
          <tag k="name" v="Elm Street" />
        </way>
      </osm>`);
    expect(ways).toHaveLength(1);
    expect(ways[0]).toMatchObject({
      id: "way/10",
      nodes: ["1", "2"],
      tags: { highway: "residential", name: "Elm Street" },
    });
    expect(ways[0].coordinates).toEqual([
      [0, 0],
      [0.001, 0],
    ]);
  });

  it("skips a way whose nodes did not come with it", () => {
    expect(
      parseOsmXml(`<osm><way id="11"><nd ref="99" /></way></osm>`),
    ).toEqual([]);
  });
});

describe("parseOverpassJson", () => {
  it("keeps node ids when the payload carries them", () => {
    const ways = parseOverpassJson({
      elements: [
        {
          type: "way",
          id: 12,
          nodes: [5, 6],
          tags: { highway: "primary" },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 0.001 },
          ],
        },
      ],
    });
    expect(ways[0].nodes).toEqual(["5", "6"]);
  });

  it("falls back to the coordinate when out geom drops the ids", () => {
    const ways = parseOverpassJson({
      elements: [
        {
          type: "way",
          id: 13,
          tags: { highway: "primary" },
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 0.001 },
          ],
        },
      ],
    });
    expect(ways[0].nodes).toEqual(["0.000000,0.000000", "0.001000,0.000000"]);
  });
});

describe("metersToPath", () => {
  it("measures to the nearest segment", () => {
    expect(
      metersToPath(destination(east20, 0, 10), [origin, east40]),
    ).toBeCloseTo(10, 0);
  });

  it("is zero inside a closed ring", () => {
    const ring: LngLat[] = [
      origin,
      east40,
      destination(east40, 0, 40),
      destination(origin, 0, 40),
      origin,
    ];
    expect(metersToPath(destination(east20, 0, 20), ring)).toBe(0);
  });
});

describe("createOsmTrace", () => {
  const cross = way(
    "way/2",
    [destination(east20, 180, 20), east20, destination(east20, 0, 20)],
    ["s", "n20", "n"],
    { highway: "residential" },
  );

  it("loads once, then answers the block under the pointer", async () => {
    const loadWays = vi.fn(async () => [avenue, cross]);
    const trace = createOsmTrace({ loadWays });
    const context = contextOf();

    const first = await trace(destination(origin, 90, 10), context);
    expect(first?.coordinates).toEqual([origin, east20]);

    const second = await trace(destination(origin, 90, 30), context);
    expect(second?.coordinates).toEqual([east20, east40, east80]);
    expect(loadWays).toHaveBeenCalledTimes(1);
  });

  it("returns the whole way when splitting is off", async () => {
    const trace = createOsmTrace({
      loadWays: async () => [avenue, cross],
      splitAtJunctions: false,
    });
    const hit = await trace(destination(origin, 90, 30), contextOf());
    expect(hit?.coordinates).toEqual(avenue.coordinates);
  });

  it("returns null past the hit distance", async () => {
    const trace = createOsmTrace({ loadWays: async () => [avenue] });
    const hit = await trace(destination(east20, 0, 400), contextOf());
    expect(hit).toBeNull();
  });

  it("survives a source that fails and retries on the next hover", async () => {
    let calls = 0;
    const trace = createOsmTrace({
      loadWays: async () => {
        calls += 1;
        if (calls === 1) throw new Error("504");
        return [avenue, cross];
      },
    });
    const context = contextOf();
    await expect(trace(origin, context)).resolves.toBeNull();
    const hit = await trace(destination(origin, 90, 10), context);
    expect(hit?.coordinates).toEqual([origin, east20]);
  });

  it("asks for the viewport the map is showing", async () => {
    const boxes: GeoBBox[] = [];
    const trace = createOsmTrace({
      loadWays: async (bbox) => {
        boxes.push(bbox);
        return [];
      },
    });
    const context = contextOf();
    context.map.getCanvas = () =>
      ({ clientWidth: 800, clientHeight: 600 }) as HTMLElement;
    await trace(origin, context);
    // The viewport is 0.0008 x 0.0006 degrees, plus 30% of that per side.
    expect(boxes[0].west).toBeCloseTo(-0.00024, 6);
    expect(boxes[0].east).toBeCloseTo(0.00104, 6);
    expect(boxes[0].south).toBeCloseTo(-0.00018, 6);
    expect(boxes[0].north).toBeCloseTo(0.00078, 6);
  });
});
