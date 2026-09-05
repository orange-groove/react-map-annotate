import { describe, expect, it } from "vitest";
import type {
  AreaAnnotation,
  MarkerAnnotation,
  PathAnnotation,
} from "../types";
import {
  applyEditHandle,
  circleResizeHandle,
  editHandleCursor,
  editableVertices,
  hitEditHandle,
  moveAnnotation,
  movePathEndpoint,
  movePolygonVertex,
  offsetLngLat,
  resizeCircle,
  resizeRectangleVertex,
} from "./edit";
import { formatMeasurement, measurePath } from "./measure";
import { destination, haversineDistance, rectangleRing } from "./geo";

const origin: [number, number] = [-73.9857, 40.7484];
const east = destination(origin, 90, 80);
const north = destination(east, 0, 60);
const west = destination(origin, 270, 40);

const rectangle: AreaAnnotation = {
  id: "rect",
  kind: "rectangle",
  label: "Rectangle",
  coordinates: rectangleRing(origin, north),
};

const polygon: AreaAnnotation = {
  id: "poly",
  kind: "polygon",
  label: "Polygon",
  coordinates: [origin, east, north, origin],
};

const circle: AreaAnnotation = {
  id: "circle",
  kind: "circle",
  label: "Circle",
  center: origin,
  radiusMeters: 80,
  coordinates: [],
};

describe("moveAnnotation", () => {
  it("translates every point by the drag delta", () => {
    const drawing: PathAnnotation = {
      id: "draw",
      kind: "draw",
      label: "Drawing",
      coordinates: [origin, east],
    };
    const moved = moveAnnotation(drawing, origin, west);
    if (moved.kind !== "draw") throw new Error("expected draw");
    expect(moved.coordinates[0]).toEqual(west);
    expect(
      haversineDistance(moved.coordinates[1], destination(east, 270, 40)),
    ).toBeLessThan(1);

    const pin: MarkerAnnotation = {
      id: "pin",
      kind: "marker",
      label: "Pin",
      coordinate: origin,
    };
    expect(moveAnnotation(pin, origin, east)).toMatchObject({
      coordinate: east,
    });
  });
});

describe("shape edits", () => {
  it("keeps the opposite rectangle corner fixed", () => {
    const vertices = editableVertices(rectangle);
    expect(vertices).toHaveLength(4);
    const next = resizeRectangleVertex(rectangle, 0, west);
    expect(next.coordinates[2]).toEqual(rectangle.coordinates[2]);
  });

  it("moves a single polygon vertex", () => {
    const next = movePolygonVertex(polygon, 1, west);
    expect(next.coordinates[1]).toEqual(west);
    expect(next.coordinates[0]).toEqual(origin);
    expect(next.coordinates[next.coordinates.length - 1]).toEqual(origin);
  });

  it("resizes a circle from the south-east handle", () => {
    const handle = circleResizeHandle(circle);
    expect(handle).toBeTruthy();
    const farther = destination(origin, 135, 160);
    const next = resizeCircle(circle, farther);
    expect(next.radiusMeters).toBeCloseTo(160, 1);
    expect(next.center).toEqual(origin);
  });

  it("does not jump when the pointer is offset from the handle", () => {
    const handle = circleResizeHandle(circle);
    expect(handle).toBeTruthy();
    const from = destination(handle!, 45, 12);
    const next = resizeCircle(circle, from, { from, handle: handle! });
    expect(next.radiusMeters).toBeCloseTo(80, 1);
  });

  it("grows by the handle movement, not the raw pointer", () => {
    const handle = circleResizeHandle(circle);
    expect(handle).toBeTruthy();
    const from = destination(handle!, 45, 12);
    const to = destination(from, 135, 40);
    const next = resizeCircle(circle, to, { from, handle: handle! });
    expect(next.radiusMeters).toBeCloseTo(
      haversineDistance(origin, offsetLngLat(handle!, from, to)),
      1,
    );
  });

  it("places the handle on the south-east screen vertex", () => {
    const southEast = destination(origin, 135, 80);
    const ring = [
      destination(origin, 0, 80),
      destination(origin, 90, 80),
      southEast,
      destination(origin, 180, 80),
      destination(origin, 0, 80),
    ];
    const shaped = { ...circle, coordinates: ring };
    const project = ({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng * 1000,
      y: -lat * 1000,
    });
    expect(circleResizeHandle(shaped, project)).toEqual(southEast);
  });
});

describe("path endpoints", () => {
  const line: PathAnnotation = {
    id: "line",
    kind: "line",
    label: "Line",
    coordinates: [origin, east],
  };

  it("exposes start and end handles for line, arrow, and measure", () => {
    expect(editableVertices(line)).toEqual([origin, east]);
    expect(editableVertices({ ...line, id: "arrow", kind: "arrow" })).toEqual([
      origin,
      east,
    ]);
    expect(
      editableVertices({
        ...line,
        id: "both",
        kind: "bidirectional-arrow",
      }),
    ).toEqual([origin, east]);
    expect(
      editableVertices({ ...line, id: "measure", kind: "measure" }),
    ).toEqual([origin, east]);
    expect(editableVertices({ ...line, id: "draw", kind: "draw" })).toEqual([]);
  });

  it("moves one endpoint and leaves the other fixed", () => {
    const startMoved = movePathEndpoint(line, "start", west);
    expect(startMoved.coordinates[0]).toEqual(west);
    expect(startMoved.coordinates[1]).toEqual(east);

    const endMoved = movePathEndpoint(line, "end", north);
    expect(endMoved.coordinates[0]).toEqual(origin);
    expect(endMoved.coordinates[1]).toEqual(north);
  });

  it("ignores a drag that would collapse a two-point path", () => {
    expect(movePathEndpoint(line, "end", origin)).toBe(line);
  });

  it("recomputes measure distance and the derived label", () => {
    const measurement = measurePath([origin, east]);
    const measure: PathAnnotation = {
      id: "measure",
      kind: "measure",
      label: formatMeasurement(measurement),
      coordinates: [origin, east],
      measurement,
    };
    const next = movePathEndpoint(measure, "end", west);
    expect(next.coordinates[1]).toEqual(west);
    expect(next.measurement?.distanceMeters).toBeCloseTo(
      haversineDistance(origin, west),
      1,
    );
    expect(next.label).toBe(formatMeasurement(next.measurement!));
  });

  it("keeps a custom measure label", () => {
    const measurement = measurePath([origin, east]);
    const measure: PathAnnotation = {
      id: "measure",
      kind: "measure",
      label: "North fence",
      coordinates: [origin, east],
      measurement,
    };
    const next = movePathEndpoint(measure, "end", west);
    expect(next.label).toBe("North fence");
  });
});

describe("handle hit radius", () => {
  const project = ({ lng, lat }: { lng: number; lat: number }) => ({
    x: lng,
    y: lat,
  });

  it("hits a vertex within 20 pixels and misses farther away", () => {
    const screenLine: PathAnnotation = {
      id: "line",
      kind: "line",
      label: "Line",
      coordinates: [
        [0, 0],
        [200, 0],
      ],
    };
    expect(hitEditHandle(project, { x: 16, y: 8 }, screenLine)).toEqual({
      kind: "vertex",
      index: 0,
    });
    expect(hitEditHandle(project, { x: 184, y: 0 }, screenLine)).toEqual({
      kind: "vertex",
      index: 1,
    });
    expect(hitEditHandle(project, { x: 100, y: 0 }, screenLine)).toBeNull();
  });

  it("uses a move cursor on vertices and a resize cursor on circles", () => {
    expect(editHandleCursor({ kind: "vertex", index: 0 })).toBe("move");
    expect(editHandleCursor({ kind: "resize", index: 0 })).toBe("nwse-resize");
  });

  it("applies the matching edit from a handle hit", () => {
    const path: PathAnnotation = {
      id: "line",
      kind: "line",
      label: "Line",
      coordinates: [origin, east],
    };
    const next = applyEditHandle(path, { kind: "vertex", index: 1 }, west);
    if (next.kind !== "line") throw new Error("expected line");
    expect(next.coordinates[0]).toEqual(origin);
    expect(next.coordinates[1]).toEqual(west);
  });
});
