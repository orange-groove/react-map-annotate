import { describe, expect, it } from "vitest";
import {
  bearingDelta,
  circleRing,
  boundsRing,
  closeRing,
  coordinateBounds,
  openRing,
  densifyPath,
  destination,
  formatArea,
  formatDistance,
  formatElevationDelta,
  haversineDistance,
  initialBearing,
  interpolateGeodesic,
  pathLength,
  pathMidpoint,
  rectangleRing,
  ringArea,
  ringCentroid,
  rotateLngLat,
} from "./geo";

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistance([-73.9857, 40.7484], [-73.9857, 40.7484])).toBe(0);
  });

  it("measures one degree of latitude near the equator", () => {
    const meters = haversineDistance([0, 0], [0, 1]);
    expect(meters).toBeGreaterThan(110_500);
    expect(meters).toBeLessThan(111_700);
  });
});

describe("destination / bearing", () => {
  it("walks north and lands near the expected latitude", () => {
    const next = destination([0, 0], 0, 1_000);
    expect(next[0]).toBeCloseTo(0, 5);
    expect(haversineDistance([0, 0], next)).toBeCloseTo(1_000, 3);
    expect(initialBearing([0, 0], next)).toBeCloseTo(0, 5);
  });
});

describe("bearingDelta", () => {
  it("returns the signed shortest turn", () => {
    expect(bearingDelta(10, 20)).toBeCloseTo(10);
    expect(bearingDelta(350, 10)).toBeCloseTo(20);
    expect(bearingDelta(10, 350)).toBeCloseTo(-20);
  });
});

describe("rotateLngLat", () => {
  it("rotates a point around a center by bearing delta", () => {
    const center: [number, number] = [0, 0];
    const east = destination(center, 90, 100);
    const south = rotateLngLat(east, center, 90);
    expect(initialBearing(center, south)).toBeCloseTo(180, 5);
    expect(haversineDistance(center, south)).toBeCloseTo(100, 3);
    expect(rotateLngLat(east, center, 0)).toEqual(east);
  });
});

describe("interpolateGeodesic", () => {
  it("returns endpoints at 0 and 1", () => {
    const a: [number, number] = [0, 0];
    const b = destination(a, 90, 100);
    expect(interpolateGeodesic(a, b, 0)).toEqual(a);
    expect(interpolateGeodesic(a, b, 1)[0]).toBeCloseTo(b[0], 8);
    expect(interpolateGeodesic(a, b, 1)[1]).toBeCloseTo(b[1], 8);
  });

  it("lands halfway along the geodesic", () => {
    const a: [number, number] = [0, 0];
    const b = destination(a, 90, 100);
    const mid = interpolateGeodesic(a, b, 0.5);
    expect(haversineDistance(a, mid)).toBeCloseTo(50, 3);
  });
});

describe("densifyPath", () => {
  it("samples a geodesic every 10 meters", () => {
    const end = destination([-73.9857, 40.7484], 90, 100);
    const samples = densifyPath([[-73.9857, 40.7484], end], 10);
    expect(samples.length).toBeGreaterThanOrEqual(11);
    expect(pathLength(samples)).toBeCloseTo(100, 1);
    for (let i = 0; i < samples.length - 1; i++) {
      expect(haversineDistance(samples[i], samples[i + 1])).toBeLessThanOrEqual(
        10.01,
      );
    }
  });

  it("returns a copy of short paths", () => {
    expect(densifyPath([[1, 2]], 10)).toEqual([[1, 2]]);
  });
});

describe("circleRing", () => {
  it("closes a geodesic circle of the requested radius", () => {
    const ring = circleRing([12, 55], 50, 32);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(haversineDistance([12, 55], ring[0])).toBeCloseTo(50, 3);
  });
});

describe("rectangleRing", () => {
  it("builds a closed bounding box", () => {
    const ring = rectangleRing([-1, -2], [3, 4]);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[0]).toEqual([-1, -2]);
    expect(ring[2]).toEqual([3, 4]);
  });
});

describe("closeRing", () => {
  it("appends the first vertex when open", () => {
    expect(
      closeRing([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
  });

  it("opens a closed ring", () => {
    expect(
      openRing([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("builds an axis-aligned bounds ring", () => {
    expect(
      coordinateBounds([
        [1, 2],
        [-1, 4],
        [0, 0],
      ]),
    ).toEqual({ west: -1, south: 0, east: 1, north: 4 });
    expect(
      boundsRing([
        [0, 0],
        [2, 1],
      ]),
    ).toEqual([
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
      [0, 0],
    ]);
  });

  it("leaves an already closed ring alone", () => {
    const closed: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 0],
    ];
    expect(closeRing(closed)).toEqual(closed);
  });
});

describe("ringCentroid", () => {
  it("ignores the closing vertex", () => {
    expect(
      ringCentroid([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ]),
    ).toEqual([1, 1]);
  });
});

describe("pathMidpoint", () => {
  it("returns a point halfway along the path", () => {
    const mid = pathMidpoint([
      [0, 0],
      [0, 1],
    ]);
    expect(haversineDistance([0, 0], mid)).toBeCloseTo(
      haversineDistance([0, 0], [0, 1]) / 2,
      3,
    );
  });

  it("returns the only point for a single-vertex path", () => {
    expect(pathMidpoint([[5, 6]])).toEqual([5, 6]);
  });
});

describe("ringArea", () => {
  it("measures a 100 m square near the equator", () => {
    const sw: [number, number] = [0, 0];
    const se = destination(sw, 90, 100);
    const ne = destination(se, 0, 100);
    expect(ringArea(rectangleRing(sw, ne))).toBeCloseTo(10_000, -2);
  });

  it("is zero for an incomplete ring", () => {
    expect(
      ringArea([
        [0, 0],
        [1, 0],
      ]),
    ).toBe(0);
  });
});

describe("formatArea", () => {
  it("switches to square kilometers above 1 km²", () => {
    expect(formatArea(20)).toBe("20 m²");
    expect(formatArea(4.2)).toBe("4.2 m²");
    expect(formatArea(1_500_000)).toBe("1.50 km²");
    expect(formatArea(Number.NaN)).toBe("0 m²");
  });
});

describe("formatDistance", () => {
  it("switches to kilometers above 1000 m", () => {
    expect(formatDistance(20)).toBe("20 m");
    expect(formatDistance(1500)).toBe("1.50 km");
    expect(formatDistance(4.2)).toBe("4.2 m");
    expect(formatDistance(Number.NaN)).toBe("0 m");
  });
});

describe("formatElevationDelta", () => {
  it("signs positive and negative deltas", () => {
    expect(formatElevationDelta(12.4)).toBe("+12 m");
    expect(formatElevationDelta(-3.2)).toBe("-3 m");
    expect(formatElevationDelta(0.2)).toBe("0 m");
  });
});
