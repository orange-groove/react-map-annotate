import { describe, expect, it } from "vitest";
import type {
  AreaAnnotation,
  MarkerAnnotation,
  PathAnnotation,
  TextAnnotation,
} from "../types";
import {
  applyEditHandle,
  canInsertVertices,
  canRemoveVertex,
  canRotateAnnotation,
  circleResizeHandle,
  editHandleCursor,
  editHandlesFor,
  editableVertices,
  hitEditHandle,
  insertVertex,
  moveAnnotation,
  movePathEndpoint,
  movePathVertex,
  movePolygonVertex,
  offsetLngLat,
  removeVertex,
  resizeCircle,
  resizeRectangleVertex,
  resizeText,
  rotateAnnotation,
  rotateHandleFor,
  rotationCenter,
  drawBoundsRing,
  drawResizeHandle,
  resizeDraw,
  textFontSize,
} from "./edit";
import { formatMeasurement, measurePath } from "./measure";
import {
  bearingDelta,
  destination,
  haversineDistance,
  initialBearing,
  rectangleRing,
  ringCentroid,
} from "./geo";

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

    const note: TextAnnotation = {
      id: "note",
      kind: "text",
      label: "Hello",
      coordinate: origin,
      style: { fontSize: 32, color: "#ef4444" },
    };
    expect(moveAnnotation(note, origin, east)).toMatchObject({
      coordinate: east,
      style: { fontSize: 32, color: "#ef4444" },
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

  it("keeps a rotated rectangle's opposite corner and orientation", () => {
    const center = ringCentroid(rectangle.coordinates);
    const rotated = rotateAnnotation(rectangle, center, 35);
    if (rotated.kind !== "rectangle") throw new Error("expected rectangle");
    const next = resizeRectangleVertex(rotated, 0, west);
    expect(next.coordinates[2]).toEqual(rotated.coordinates[2]);
    const axisAligned = rectangleRing(next.coordinates[2], next.coordinates[0]);
    expect(next.coordinates[1][0]).not.toBeCloseTo(axisAligned[1][0], 5);
    expect(next.coordinates[1][1]).not.toBeCloseTo(axisAligned[1][1], 5);
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
    expect(
      editableVertices({
        ...line,
        id: "poly-line",
        coordinates: [origin, east, north],
      }),
    ).toEqual([origin, east, north]);
    expect(editableVertices({ ...line, id: "arrow", kind: "arrow" })).toEqual([
      origin,
      east,
    ]);
    expect(canInsertVertices({ ...line, id: "trace", kind: "trace" })).toBe(
      false,
    );
    expect(editableVertices({ ...line, id: "trace", kind: "trace" })).toEqual(
      [],
    );
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
    expect(hitEditHandle(project, { x: 100, y: 0 }, screenLine)).toEqual({
      kind: "insert",
      index: 0,
    });
    expect(hitEditHandle(project, { x: 100, y: 40 }, screenLine)).toBeNull();
  });

  it("uses a move cursor on vertices and a resize cursor on circles", () => {
    expect(editHandleCursor({ kind: "vertex", index: 0 })).toBe("move");
    expect(editHandleCursor({ kind: "insert", index: 0 })).toBe("pointer");
    expect(editHandleCursor({ kind: "resize", index: 0 })).toBe("nwse-resize");
    expect(editHandleCursor({ kind: "rotate", index: 0 })).toBe("grab");
    expect(editHandleCursor({ kind: "rotate", index: 0 }, true)).toBe(
      "grabbing",
    );
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

  it("moves an interior path vertex by index", () => {
    const path: PathAnnotation = {
      id: "line",
      kind: "line",
      label: "Line",
      coordinates: [origin, east, north],
    };
    const next = movePathVertex(path, 1, west);
    expect(next.coordinates).toEqual([origin, west, north]);
  });
});

describe("vertex insert and delete", () => {
  it("inserts a polygon vertex on an edge and keeps the ring closed", () => {
    const next = insertVertex(polygon, 0, west);
    expect(next.kind).toBe("polygon");
    if (next.kind !== "polygon") throw new Error("expected polygon");
    expect(next.coordinates).toEqual([origin, west, east, north, origin]);
  });

  it("removes a polygon vertex down to a triangle", () => {
    const quad: AreaAnnotation = {
      id: "poly",
      kind: "polygon",
      label: "Polygon",
      coordinates: [origin, east, north, west, origin],
    };
    const next = removeVertex(quad, 1);
    if (next.kind !== "polygon") throw new Error("expected polygon");
    expect(next.coordinates).toEqual([origin, north, west, origin]);
    expect(removeVertex(polygon, 1)).toBe(polygon);
    expect(canRemoveVertex(polygon, 1)).toBe(false);
    expect(canRemoveVertex(quad, 1)).toBe(true);
  });

  it("inserts and removes vertices on lines and measures", () => {
    const line: PathAnnotation = {
      id: "line",
      kind: "line",
      label: "Line",
      coordinates: [origin, east],
    };
    expect(canInsertVertices(line)).toBe(true);
    const inserted = insertVertex(line, 0, north);
    if (inserted.kind !== "line") throw new Error("expected line");
    expect(inserted.coordinates).toEqual([origin, north, east]);
    expect(removeVertex(inserted, 1)).toEqual(line);
    expect(removeVertex(line, 0)).toBe(line);

    const measurement = measurePath([origin, east]);
    const measure: PathAnnotation = {
      id: "measure",
      kind: "measure",
      label: formatMeasurement(measurement),
      coordinates: [origin, east],
      measurement,
    };
    const bent = insertVertex(measure, 0, west);
    if (bent.kind !== "measure") throw new Error("expected measure");
    expect(bent.coordinates).toHaveLength(3);
    expect(bent.measurement?.distanceMeters).toBeCloseTo(
      haversineDistance(origin, west) + haversineDistance(west, east),
      1,
    );
  });

  it("does not insert on rectangles or circles", () => {
    expect(canInsertVertices(rectangle)).toBe(false);
    expect(insertVertex(rectangle, 0, west)).toBe(rectangle);
    expect(canInsertVertices(circle)).toBe(false);
  });

  it("applies an insert handle to a two-point line", () => {
    const path: PathAnnotation = {
      id: "line",
      kind: "line",
      label: "Line",
      coordinates: [origin, east],
    };
    const next = applyEditHandle(path, { kind: "insert", index: 0 }, west);
    if (next.kind !== "line") throw new Error("expected line");
    expect(next.coordinates).toEqual([origin, west, east]);
  });
});

describe("rotate", () => {
  const drawing: PathAnnotation = {
    id: "draw",
    kind: "draw",
    label: "Drawing",
    coordinates: [origin, east, north],
  };

  it("exposes a rotate handle on drawings, rectangles, polygons, and text", () => {
    const note: TextAnnotation = {
      id: "note",
      kind: "text",
      label: "Hello",
      coordinate: origin,
    };
    expect(canRotateAnnotation(drawing)).toBe(true);
    expect(canRotateAnnotation(rectangle)).toBe(true);
    expect(canRotateAnnotation(polygon)).toBe(true);
    expect(canRotateAnnotation(note)).toBe(true);
    expect(canRotateAnnotation(circle)).toBe(false);
    expect(
      editHandlesFor(drawing).some((handle) => handle.kind === "rotate"),
    ).toBe(true);
    expect(
      editHandlesFor(rectangle).some((handle) => handle.kind === "rotate"),
    ).toBe(true);
    expect(
      editHandlesFor(polygon).some((handle) => handle.kind === "rotate"),
    ).toBe(true);
    expect(
      editHandlesFor(note).some((handle) => handle.kind === "rotate"),
    ).toBe(true);
  });

  it("places the rotate handle beyond the top-right corner", () => {
    const center = rotationCenter(rectangle);
    const corner = rectangle.coordinates[2];
    const handle = rotateHandleFor(rectangle);
    expect(center).toBeTruthy();
    expect(corner).toBeTruthy();
    expect(handle).toBeTruthy();
    expect(haversineDistance(center!, handle!)).toBeGreaterThan(
      haversineDistance(center!, corner!),
    );
  });

  it("rotates every drawing vertex around the centroid", () => {
    const center = rotationCenter(drawing);
    expect(center).toBeTruthy();
    const rotated = rotateAnnotation(drawing, center!, 90);
    if (rotated.kind !== "draw") throw new Error("expected draw");
    for (const [index, coordinate] of drawing.coordinates.entries()) {
      expect(
        haversineDistance(center!, rotated.coordinates[index]),
      ).toBeCloseTo(haversineDistance(center!, coordinate), 1);
      expect(
        bearingDelta(
          initialBearing(center!, coordinate) + 90,
          initialBearing(center!, rotated.coordinates[index]),
        ),
      ).toBeCloseTo(0, 0);
    }
    expect(rotated.rotation).toBe(90);
  });

  it("keeps the drawing outline and rotate handle on the oriented box", () => {
    const center = rotationCenter(drawing)!;
    const rotated = rotateAnnotation(drawing, center, 40);
    if (rotated.kind !== "draw") throw new Error("expected draw");
    const box = drawBoundsRing(rotated);
    expect(box[0]?.[1]).not.toBeCloseTo(box[1]?.[1] ?? 0, 5);
    const handle = rotateHandleFor(rotated)!;
    expect(haversineDistance(center, handle)).toBeGreaterThan(
      haversineDistance(center, box[2]!),
    );
    expect(
      bearingDelta(
        initialBearing(center, box[2]!),
        initialBearing(center, handle),
      ),
    ).toBeCloseTo(0, 0);
  });

  it("anchors the drawing resize handle on the oriented box", () => {
    expect(drawResizeHandle(drawing)).toEqual(drawBoundsRing(drawing)[1]);
    const center = rotationCenter(drawing)!;
    const rotated = rotateAnnotation(drawing, center, 40);
    if (rotated.kind !== "draw") throw new Error("expected draw");
    const box = drawBoundsRing(rotated);
    expect(drawResizeHandle(rotated)).toEqual(box[1]);
    const resize = editHandlesFor(rotated).find(
      (handle) => handle.kind === "resize",
    );
    expect(resize?.coordinate).toEqual(box[1]);
  });

  it("resizes a drawing from the box corner", () => {
    const handle = drawResizeHandle(drawing)!;
    const opposite = drawBoundsRing(drawing)[3]!;
    const farther = destination(
      opposite,
      initialBearing(opposite, handle),
      haversineDistance(opposite, handle) * 2,
    );
    const next = resizeDraw(drawing, farther);
    expect(
      haversineDistance(next.coordinates[0], next.coordinates[1]),
    ).toBeGreaterThan(
      haversineDistance(drawing.coordinates[0], drawing.coordinates[1]),
    );
  });

  it("applies a rotate handle from the pointer bearing", () => {
    const center = rotationCenter(rectangle);
    const handle = rotateHandleFor(rectangle);
    expect(center).toBeTruthy();
    expect(handle).toBeTruthy();
    const distance = haversineDistance(center!, handle!);
    const next = destination(
      center!,
      initialBearing(center!, handle!) + 45,
      distance,
    );
    const rotated = applyEditHandle(
      rectangle,
      { kind: "rotate", index: 0 },
      next,
    );
    if (rotated.kind !== "rectangle") throw new Error("expected rectangle");
    const first = rectangle.coordinates[0];
    const moved = rotated.coordinates[0];
    expect(haversineDistance(center!, moved)).toBeCloseTo(
      haversineDistance(center!, first),
      1,
    );
    expect(
      bearingDelta(
        initialBearing(center!, first) + 45,
        initialBearing(center!, moved),
      ),
    ).toBeCloseTo(0, 0);
  });

  it("rotates polygon vertices around the centroid", () => {
    const center = rotationCenter(polygon);
    expect(center).toBeTruthy();
    const rotated = rotateAnnotation(polygon, center!, 40);
    if (rotated.kind !== "polygon") throw new Error("expected polygon");
    expect(haversineDistance(center!, rotated.coordinates[0])).toBeCloseTo(
      haversineDistance(center!, polygon.coordinates[0]),
      1,
    );
    expect(rotated.rotation).toBe(40);
  });

  it("keeps the polygon rotate handle on the oriented top-right", () => {
    const center = rotationCenter(polygon)!;
    const rotated = rotateAnnotation(polygon, center, 40);
    if (rotated.kind !== "polygon") throw new Error("expected polygon");
    const handle = rotateHandleFor(rotated)!;
    const before = rotateHandleFor(polygon)!;
    expect(
      bearingDelta(
        initialBearing(center, before),
        initialBearing(center, handle),
      ),
    ).toBeCloseTo(40, 0);
  });

  it("stores text rotation without moving the anchor", () => {
    const note: TextAnnotation = {
      id: "note",
      kind: "text",
      label: "Hello",
      coordinate: origin,
    };
    const handle = rotateHandleFor(note);
    expect(handle).toBeTruthy();
    const next = destination(
      origin,
      initialBearing(origin, handle!) + 30,
      haversineDistance(origin, handle!),
    );
    const rotated = applyEditHandle(note, { kind: "rotate", index: 0 }, next);
    if (rotated.kind !== "text") throw new Error("expected text");
    expect(rotated.coordinate).toEqual(origin);
    expect(rotated.rotation).toBeCloseTo(30, 0);
  });
});

describe("resizeText", () => {
  const note: TextAnnotation = {
    id: "note",
    kind: "text",
    label: "Hello",
    coordinate: origin,
    style: { color: "#2563eb", fontSize: 28 },
  };

  it("updates font size and clamps to the allowed range", () => {
    expect(textFontSize(note)).toBe(28);
    expect(resizeText(note, 48).style?.fontSize).toBe(48);
    expect(resizeText(note, 2).style?.fontSize).toBe(12);
    expect(resizeText(note, 400).style?.fontSize).toBe(160);
    expect(note.style?.fontSize).toBe(28);
  });
});
