import { describe, expect, it } from "vitest";
import {
  eventLngLat,
  eventPoint,
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
  setMapCursor,
  setPointerCursor,
} from "./interaction";

describe("eventLngLat", () => {
  it("reads lng/lat from a map event", () => {
    expect(eventLngLat({ lngLat: { lng: -73.9, lat: 40.7 } })).toEqual([
      -73.9, 40.7,
    ]);
  });
});

describe("eventPoint", () => {
  it("reads a screen point or projects lng/lat", () => {
    expect(eventPoint({ point: { x: 12, y: 8 } })).toEqual({ x: 12, y: 8 });
    expect(
      eventPoint(
        {},
        { project: ({ lng, lat }) => ({ x: lng, y: lat }) },
        { lng: 4, lat: 5 },
      ),
    ).toEqual({ x: 4, y: 5 });
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

describe("pointer cursors", () => {
  it("sets the map canvas and its host", () => {
    const host = document.createElement("div");
    const canvas = document.createElement("canvas");
    host.append(canvas);
    setMapCursor({ getCanvas: () => canvas }, "grabbing");
    expect(canvas.style.cursor).toBe("grabbing");
    expect(host.style.cursor).toBe("grabbing");
  });

  it("locks the document cursor while dragging", () => {
    setPointerCursor("grabbing");
    expect(document.documentElement.classList.contains("rma-dragging")).toBe(
      true,
    );
    expect(
      document.documentElement.style.getPropertyValue("--rma-pointer-cursor"),
    ).toBe("grabbing");
    setPointerCursor(null);
    expect(document.documentElement.classList.contains("rma-dragging")).toBe(
      false,
    );
  });
});
