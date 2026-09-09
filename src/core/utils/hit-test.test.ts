import { describe, expect, it } from "vitest";
import type { Annotation } from "../types";
import {
  annotateClickTarget,
  annotationVisualScreenBounds,
  distanceToSegment,
  groupVisualScreenBounds,
  hitTestAnnotations,
  idsInScreenRect,
  overlayVisualRects,
  padScreenRect,
  pointInRing,
  unionScreenRects,
} from "./hit-test";

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

  it("ignores annotations the host has hidden", () => {
    expect(
      hitTestAnnotations(project, { x: 50, y: 4 }, [
        { ...line, visible: false },
      ]),
    ).toBeNull();
    expect(
      idsInScreenRect(project, { x: -10, y: -10, width: 400, height: 400 }, [
        { ...line, visible: false },
        polygon,
      ]),
    ).toEqual(["poly-1"]);
  });

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

  it("hits rotated text in the turned box", () => {
    const text: Annotation = {
      id: "text-1",
      kind: "text",
      label: "Hello",
      coordinate: [1, 1],
      rotation: 90,
      style: { fontSize: 28 },
    };
    expect(hitTestAnnotations(project, { x: 100, y: 100 }, [text])).toBe(
      "text-1",
    );
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

describe("group visual screen bounds", () => {
  const project = ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng * 100,
    y: lat * 100,
  });

  it("unions and pads rectangles", () => {
    expect(
      unionScreenRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 8, y: -4, width: 10, height: 6 },
      ]),
    ).toEqual({ x: 0, y: -4, width: 18, height: 14 });
    expect(padScreenRect({ x: 10, y: 20, width: 8, height: 6 }, 4)).toEqual({
      x: 6,
      y: 16,
      width: 16,
      height: 14,
    });
  });

  it("wraps a marker pin and its label, not just the tip", () => {
    const marker: Annotation = {
      id: "pin-1",
      kind: "marker",
      label: "Marker",
      coordinate: [1, 1],
    };
    const bounds = annotationVisualScreenBounds(project, marker);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeLessThan(100);
    expect(bounds!.x + bounds!.width).toBeGreaterThan(100);
    expect(bounds!.y).toBeLessThan(100 - 40);
    expect(bounds!.y + bounds!.height).toBe(100);
  });

  it("unions grouped markers so the box covers pins and labels", () => {
    const left: Annotation = {
      id: "a",
      kind: "marker",
      label: "Marker",
      coordinate: [0, 0],
      groupId: "g1",
    };
    const right: Annotation = {
      id: "b",
      kind: "marker",
      label: "Marker",
      coordinate: [1, 0],
      groupId: "g1",
    };
    const bounds = groupVisualScreenBounds(project, [left, right]);
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(100);
    expect(bounds!.height).toBeGreaterThan(40);
    expect(bounds!.y + bounds!.height).toBe(0);
    expect(bounds!.y).toBeLessThan(-40);
  });

  it("expands the group box with overlay pin and label rects", () => {
    const left: Annotation = {
      id: "a",
      kind: "marker",
      label: "Marker",
      coordinate: [0, 0],
      groupId: "g1",
    };
    const right: Annotation = {
      id: "b",
      kind: "marker",
      label: "Marker",
      coordinate: [1, 0],
      groupId: "g1",
    };
    const estimated = groupVisualScreenBounds(project, [left, right]);
    const overlay = groupVisualScreenBounds(
      project,
      [left, right],
      [
        { x: -20, y: -90, width: 40, height: 20 },
        { x: 80, y: -90, width: 40, height: 20 },
      ],
    );
    expect(overlay!.y).toBeLessThan(estimated!.y);
    expect(overlay!.height).toBeGreaterThan(estimated!.height);
  });

  it("reads overlay pin and label boxes relative to the map host", () => {
    const host = document.createElement("div");
    host.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 400,
        height: 300,
        right: 410,
        bottom: 320,
        x: 10,
        y: 20,
        toJSON: () => undefined,
      }) as DOMRect;
    const pin = document.createElement("div");
    pin.setAttribute("data-rma-marker", "a");
    pin.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 80,
        width: 27,
        height: 40,
        right: 67,
        bottom: 120,
        x: 40,
        y: 80,
        toJSON: () => undefined,
      }) as DOMRect;
    const label = document.createElement("div");
    label.setAttribute("data-rma-label", "a");
    label.getBoundingClientRect = () =>
      ({
        left: 30,
        top: 50,
        width: 48,
        height: 22,
        right: 78,
        bottom: 72,
        x: 30,
        y: 50,
        toJSON: () => undefined,
      }) as DOMRect;
    host.append(pin, label);
    expect(overlayVisualRects(host, ["a"])).toEqual([
      { x: 30, y: 60, width: 27, height: 40 },
      { x: 20, y: 30, width: 48, height: 22 },
    ]);
  });
});

describe("annotateClickTarget", () => {
  it("reports a click the library consumed, with the annotation id", () => {
    expect(
      annotateClickTarget([
        { layer: { id: "rma-line" }, properties: { id: "a1" } },
        { layer: { id: "roads" }, properties: { id: "road-9" } },
      ]),
    ).toEqual({ consumed: true, id: "a1" });
  });

  it("consumes draft geometry without naming an annotation", () => {
    expect(
      annotateClickTarget([
        { layer: { id: "rma-fill" }, properties: { id: "draft" } },
      ]),
    ).toEqual({ consumed: true, id: null });
  });

  it("leaves host layers alone", () => {
    expect(
      annotateClickTarget([
        { layer: { id: "project-outline" }, properties: { id: "p7" } },
      ]),
    ).toEqual({ consumed: false, id: null });
    expect(annotateClickTarget([])).toEqual({ consumed: false, id: null });
  });
});
