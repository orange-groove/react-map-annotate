import { describe, expect, it } from "vitest";
import {
  eventLngLat,
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
} from "./interaction";

describe("eventLngLat", () => {
  it("reads lng/lat from a map event", () => {
    expect(eventLngLat({ lngLat: { lng: -73.9, lat: 40.7 } })).toEqual([
      -73.9, 40.7,
    ]);
  });
});

describe("lastTwoEqual", () => {
  it("detects a duplicated last vertex", () => {
    expect(
      lastTwoEqual([
        [0, 0],
        [1, 1],
        [1, 1],
      ]),
    ).toBe(true);
    expect(
      lastTwoEqual([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(false);
    expect(lastTwoEqual([[0, 0]])).toBe(false);
  });
});

describe("nearFirstVertex", () => {
  const map = {
    project: ({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng * 100,
      y: lat * 100,
    }),
  };

  it("is true within 12 pixels of the first vertex", () => {
    expect(nearFirstVertex(map, [0, 0], [0.05, 0.05])).toBe(true);
    expect(nearFirstVertex(map, [0, 0], [1, 1])).toBe(false);
  });
});

describe("isUiTarget", () => {
  it("ignores non-elements", () => {
    expect(isUiTarget(null)).toBe(false);
  });
});
