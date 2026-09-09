import { describe, expect, it } from "vitest";
import type { MarkerAnnotation, PathAnnotation } from "../types";
import {
  cloneAnnotation,
  duplicateAnnotationRight,
  parseAnnotationClipboard,
  parseAnnotationClipboardItems,
  placeAnnotationAt,
  placeAnnotationsAt,
  serializeAnnotationClipboard,
} from "./clipboard";

const line: PathAnnotation = {
  id: "line-1",
  kind: "line",
  label: "Fence",
  coordinates: [
    [-73.99, 40.75],
    [-73.98, 40.75],
  ],
};

const pin: MarkerAnnotation = {
  id: "pin-1",
  kind: "marker",
  label: "Pin",
  coordinate: [-73.99, 40.75],
};

describe("cloneAnnotation", () => {
  it("copies the shape and assigns a new id", () => {
    const copy = cloneAnnotation(line);
    expect(copy.id).not.toBe(line.id);
    expect(copy).toMatchObject({
      kind: "line",
      label: "Fence",
      coordinates: line.coordinates,
    });
  });
});

describe("annotation clipboard", () => {
  it("round-trips through the clipboard payload", () => {
    const parsed = parseAnnotationClipboard(serializeAnnotationClipboard(pin));
    expect(parsed).toMatchObject({
      kind: "marker",
      label: "Pin",
      coordinate: pin.coordinate,
    });
  });

  it("rejects unrelated JSON", () => {
    expect(parseAnnotationClipboard('{"hello":true}')).toBeNull();
    expect(parseAnnotationClipboard("not-json")).toBeNull();
  });

  it("round-trips a set of annotations", () => {
    const parsed = parseAnnotationClipboardItems(
      serializeAnnotationClipboard([pin, line]),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ kind: "marker", label: "Pin" });
    expect(parsed[1]).toMatchObject({ kind: "line", label: "Fence" });
  });

  it("still reads the v1 clipboard payload", () => {
    const parsed = parseAnnotationClipboardItems(
      JSON.stringify({ v: 1, annotation: pin }),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ kind: "marker", label: "Pin" });
  });
});

describe("placeAnnotationsAt", () => {
  it("moves the set together and remaps group ids", () => {
    const groupedLine = { ...line, groupId: "g1" };
    const groupedPin = { ...pin, groupId: "g1" };
    const placed = placeAnnotationsAt(
      [groupedPin, groupedLine],
      [-73.97, 40.76],
    );
    expect(placed).toHaveLength(2);
    expect(placed[0]?.id).not.toBe(pin.id);
    expect(placed[0]?.groupId).toBeTruthy();
    expect(placed[0]?.groupId).not.toBe("g1");
    expect(placed[0]?.groupId).toBe(placed[1]?.groupId);
    if (placed[0]?.kind !== "marker") throw new Error("expected marker");
    expect(placed[0].coordinate).toEqual([-73.97, 40.76]);
  });
});

describe("placeAnnotationAt", () => {
  it("moves the copy so its anchor sits on the target", () => {
    const placed = placeAnnotationAt(pin, [-73.97, 40.76]);
    expect(placed.id).not.toBe(pin.id);
    if (placed.kind !== "marker") throw new Error("expected marker");
    expect(placed.coordinate).toEqual([-73.97, 40.76]);
  });
});

describe("duplicateAnnotationRight", () => {
  it("shifts the copy to the right in screen space", () => {
    const copy = duplicateAnnotationRight(
      line,
      ([lng, lat]) => ({ x: lng * 1000, y: lat * 1000 }),
      (point) => [point.x / 1000, point.y / 1000],
      40,
    );
    expect(copy.id).not.toBe(line.id);
    if (copy.kind !== "line") throw new Error("expected line");
    expect(copy.coordinates[0][0]).toBeCloseTo(line.coordinates[0][0] + 0.04);
    expect(copy.coordinates[1][0]).toBeCloseTo(line.coordinates[1][0] + 0.04);
    expect(copy.coordinates[0][1]).toBeCloseTo(line.coordinates[0][1]);
  });
});
