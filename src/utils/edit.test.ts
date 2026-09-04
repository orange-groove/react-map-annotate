import { describe, expect, it } from "vitest";
import type {
  AreaAnnotation,
  MarkerAnnotation,
  PathAnnotation,
} from "../types";
import {
  circleResizeHandle,
  editableVertices,
  moveAnnotation,
  movePolygonVertex,
  resizeCircle,
  resizeRectangleVertex,
} from "./edit";
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
});
