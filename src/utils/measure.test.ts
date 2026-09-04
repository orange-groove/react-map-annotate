import { describe, expect, it } from "vitest";
import { destination } from "./geo";
import {
  formatMeasurement,
  measurePath,
  queryGroundElevation,
} from "./measure";

describe("measurePath", () => {
  it("uses haversine length and 10 m elevation samples", () => {
    const start: [number, number] = [-122.4194, 37.7749];
    const end = destination(start, 45, 100);
    const measurement = measurePath(
      [start, end],
      (coordinate) =>
        coordinate[0] === start[0] && coordinate[1] === start[1] ? 10 : 22,
      10,
    );

    expect(measurement.distanceMeters).toBeCloseTo(100, 1);
    expect(measurement.samples.length).toBeGreaterThanOrEqual(11);
    expect(measurement.samples[1].distanceAlongMeters).toBeCloseTo(10, 1);
  });

  it("accumulates elevation gain and loss from ground samples", () => {
    const points: Array<[number, number]> = [
      [0, 0],
      destination([0, 0], 0, 10),
      destination(destination([0, 0], 0, 10), 0, 10),
    ];
    const elevations = [10, 18, 12];
    let i = 0;
    const measurement = measurePath(
      points,
      () => elevations[Math.min(i++, elevations.length - 1)],
      10,
    );
    expect(measurement.elevationGainMeters).toBeCloseTo(8, 5);
    expect(measurement.elevationLossMeters).toBeCloseTo(6, 5);
    expect(measurement.minElevationMeters).toBe(10);
    expect(measurement.maxElevationMeters).toBe(18);
  });
});

describe("queryGroundElevation", () => {
  it("returns null without a terrain query", () => {
    expect(queryGroundElevation(null, [0, 0])).toBeNull();
    expect(queryGroundElevation(undefined, [0, 0])).toBeNull();
  });

  it("reads unexaggerated terrain height", () => {
    const map = {
      queryTerrainElevation: () => 42,
    };
    expect(queryGroundElevation(map, [1, 2])).toBe(42);
  });

  it("swallows terrain query failures", () => {
    const map = {
      queryTerrainElevation: () => {
        throw new Error("no terrain");
      },
    };
    expect(queryGroundElevation(map, [1, 2])).toBeNull();
  });
});

describe("formatMeasurement", () => {
  it("includes elevation when present", () => {
    expect(
      formatMeasurement({
        distanceMeters: 42,
        samples: [],
        elevationGainMeters: 5,
        elevationLossMeters: 2,
        minElevationMeters: 1,
        maxElevationMeters: 6,
      }),
    ).toBe("42 m · +5 m / -2 m");
  });

  it("is distance-only without elevation", () => {
    expect(
      formatMeasurement({
        distanceMeters: 42,
        samples: [],
        elevationGainMeters: 0,
        elevationLossMeters: 0,
        minElevationMeters: null,
        maxElevationMeters: null,
      }),
    ).toBe("42 m");
  });
});
