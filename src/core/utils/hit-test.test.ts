import { describe, expect, it } from "vitest";
import type { Annotation } from "../types";
import { distanceToSegment, hitTestAnnotations, idsInScreenRect, pointInRing } from "./hit-test";

describe("distanceToSegment", () => {
  it("measures a perpendicular drop to the segment", () => {
    expect(
      distanceToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(4);
  });

  it("clamps to the nearer endpoint", () => {
    expect(
      distanceToSegment({ x: -3, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(3);
  });
});

describe("pointInRing", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 0 },
  ];

  it("detects a point inside a ring", () => {
    expect(pointInRing({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInRing({ x: 20, y: 5 }, square)).toBe(false);
  });
});

describe("hitTestAnnotations", () => {
  const project = ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng * 100,
    y: lat * 100,
  });

  const line: Annotation = {
    id: "line-1",
    kind: "line",
    label: "Line",
    coordinates: [
      [0, 0],
      [1, 0],
    ],
  };

  const polygon: Annotation = {
    id: "poly-1",
    kind: "polygon",
    label: "Poly",
    coordinates: [
      [2, 2],
      [3, 2],
      [3, 3],
      [2, 3],
      [2, 2],
    ],
  };

  it("hits a line within 9 pixels", () => {
    expect(hitTestAnnotations(project, { x: 50, y: 4 }, [line])).toBe("line-1");
    expect(hitTestAnnotations(project, { x: 50, y: 20 }, [line])).toBeNull();
  });

  it("hits a polygon fill", () => {
    expect(hitTestAnnotations(project, { x: 250, y: 250 }, [polygon])).toBe(
      "poly-1",
    );
  });

  it("hits a marker pin above its coordinate", () => {
    const marker: Annotation = {
      id: "pin-1",
      kind: "marker",
      label: "Pin",
      coordinate: [1, 1],
    };
    expect(hitTestAnnotations(project, { x: 100, y: 80 }, [marker])).toBe(
      "pin-1",
    );
    expect(hitTestAnnotations(project, { x: 100, y: 120 }, [marker])).toBe(
      "pin-1",
    );
    expect(
      hitTestAnnotations(project, { x: 100, y: 160 }, [marker]),
    ).toBeNull();
  });

  it("hits a text annotation around its anchor", () => {
    const text: Annotation = {
      id: "text-1",
      kind: "text",
      label: "Hello",
      coordinate: [1, 1],
      style: { fontSize: 28 },
    };
    expect(hitTestAnnotations(project, { x: 100, y: 100 }, [text])).toBe(
      "text-1",
    );
    expect(hitTestAnnotations(project, { x: 400, y: 400 }, [text])).toBeNull();
  });

  it("prefers the later path when two overlap", () => {
    const other: Annotation = {
      ...line,
      id: "line-2",
    };
    expect(hitTestAnnotations(project, { x: 50, y: 0 }, [line, other])).toBe(
      "line-2",
    );
  });
});

describe("idsInScreenRect", () => {
  const project = ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng * 100,
    y: lat * 100,
  });

  it("selects annotations whose bounds overlap the marquee", () => {
    const line: Annotation = {
      id: "line-1",
      kind: "line",
      label: "Line",
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    };
    const far: Annotation = {
      id: "line-2",
      kind: "line",
      label: "Far",
      coordinates: [
        [8, 8],
        [9, 8],
      ],
    };
    expect(
      idsInScreenRect(project, { x: 0, y: -4, width: 120, height: 10 }, [
        line,
        far,
      ]),
    ).toEqual(["line-1"]);
  });

  it("ignores a tiny drag", () => {
    expect(
      idsInScreenRect(project, { x: 0, y: 0, width: 2, height: 2 }, []),
    ).toEqual([]);
  });
});
