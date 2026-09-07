import { describe, expect, it } from "vitest";
import { DEFAULT_LABELS } from "../constants";
import type { AnnotationKind, DraftAnnotation } from "../types";
import {
  annotationFromDraft,
  canFinishDraft,
  canPressFinish,
  cssColorForInput,
  committedDraftCoordinates,
  annotationAreaMeters,
  isAreaAnnotation,
  isArrowAnnotation,
  isMarkerAnnotation,
  isPathAnnotation,
  isTextAnnotation,
  labelAnchor,
  minVerticesForKind,
  previewCoordinates,
  removeAnnotation,
  setAnnotationColor,
  setAnnotationLabel,
  setAnnotationStyle,
  updateAnnotationColor,
  updateAnnotationLabel,
  upsertAnnotation,
} from "./annotations";
import { destination, haversineDistance } from "./geo";

const origin: [number, number] = [-73.9857, 40.7484];
const east = destination(origin, 90, 120);
const north = destination(east, 0, 80);
const west = destination(north, 270, 60);

const PATH_KINDS = [
  "draw",
  "trace",
  "line",
  "arrow",
  "bidirectional-arrow",
  "measure",
] as const satisfies AnnotationKind[];

function draft(
  kind: AnnotationKind,
  coordinates: Array<[number, number]>,
  cursor?: [number, number],
): DraftAnnotation {
  return { kind, coordinates, cursor };
}

describe("annotationFromDraft", () => {
  it.each(PATH_KINDS)("creates a %s path annotation", (kind) => {
    const annotation = annotationFromDraft(draft(kind, [origin, east]), {
      id: kind,
    });
    expect(annotation).toMatchObject({
      id: kind,
      kind,
      coordinates: [origin, east],
    });
    expect(annotation && isPathAnnotation(annotation)).toBe(true);
  });

  it("creates a freehand drawing from preview coordinates", () => {
    const annotation = annotationFromDraft(draft("draw", [origin], east), {
      id: "draw-1",
    });
    expect(annotation).toMatchObject({
      kind: "draw",
      coordinates: [origin, east],
      label: DEFAULT_LABELS.draw,
    });
  });

  it("creates a circle with geodesic radius and ring", () => {
    const annotation = annotationFromDraft(draft("circle", [origin, east]), {
      id: "circle",
    });
    expect(annotation?.kind).toBe("circle");
    if (annotation?.kind !== "circle") return;
    expect(annotation.center).toEqual(origin);
    expect(annotation.radiusMeters).toBeCloseTo(120, 1);
    expect(annotation.coordinates[0]).toEqual(
      annotation.coordinates[annotation.coordinates.length - 1],
    );
    expect(haversineDistance(origin, annotation.coordinates[0])).toBeCloseTo(
      120,
      1,
    );
    expect(isAreaAnnotation(annotation)).toBe(true);
    expect(annotationAreaMeters(annotation)).toBeCloseTo(
      Math.PI * 120 * 120,
      0,
    );
  });

  it("creates a closed rectangle", () => {
    const annotation = annotationFromDraft(draft("rectangle", [origin, east]), {
      id: "rect",
    });
    expect(annotation?.kind).toBe("rectangle");
    if (annotation?.kind !== "rectangle") return;
    expect(annotation.coordinates).toHaveLength(5);
    expect(annotation.coordinates[0]).toEqual(
      annotation.coordinates[annotation.coordinates.length - 1],
    );
  });

  it("creates a closed polygon", () => {
    const annotation = annotationFromDraft(
      draft("polygon", [origin, east, north]),
      { id: "poly" },
    );
    expect(annotation?.kind).toBe("polygon");
    if (annotation?.kind !== "polygon") return;
    expect(annotation.coordinates[annotation.coordinates.length - 1]).toEqual(
      origin,
    );
    expect(annotation.label).toBe(DEFAULT_LABELS.polygon);
  });

  it("closes a polygon using the cursor as the last vertex", () => {
    const annotation = annotationFromDraft(
      draft("polygon", [origin, east], north),
      { id: "poly-cursor" },
    );
    expect(annotation?.kind).toBe("polygon");
    if (annotation?.kind !== "polygon") return;
    expect(annotation.coordinates).toEqual([origin, east, north, origin]);
  });

  it("creates a labeled marker", () => {
    const annotation = annotationFromDraft(draft("marker", [origin]), {
      id: "pin",
      color: "#ef4444",
    });
    expect(annotation).toEqual({
      id: "pin",
      kind: "marker",
      label: DEFAULT_LABELS.marker,
      coordinate: origin,
      style: { color: "#ef4444" },
    });
    expect(annotation && isMarkerAnnotation(annotation)).toBe(true);
  });

  it("creates a colored text annotation", () => {
    const annotation = annotationFromDraft(draft("text", [origin]), {
      id: "note",
      color: "#ef4444",
    });
    expect(annotation).toMatchObject({
      id: "note",
      kind: "text",
      label: DEFAULT_LABELS.text,
      coordinate: origin,
      style: { color: "#ef4444", fontSize: 28 },
    });
    expect(annotation && isTextAnnotation(annotation)).toBe(true);
  });

  it("applies a default font family to new text", () => {
    const annotation = annotationFromDraft(draft("text", [origin]), {
      id: "note",
      fontFamily: '"Inter", sans-serif',
    });
    expect(annotation?.style?.fontFamily).toBe('"Inter", sans-serif');
  });

  it("samples measure paths every 10 m", () => {
    const annotation = annotationFromDraft(draft("measure", [origin, east]), {
      id: "measure",
    });
    expect(annotation?.kind).toBe("measure");
    if (annotation?.kind !== "measure") return;
    expect(annotation.measurement?.distanceMeters).toBeCloseTo(120, 1);
    expect(annotation.measurement?.samples.length).toBeGreaterThanOrEqual(13);
    expect(annotation.label).toContain("m");
  });

  it("rejects incomplete drafts for every kind", () => {
    expect(annotationFromDraft(draft("marker", []))).toBeNull();
    expect(annotationFromDraft(draft("text", []))).toBeNull();
    expect(annotationFromDraft(draft("line", [origin]))).toBeNull();
    expect(annotationFromDraft(draft("arrow", [origin]))).toBeNull();
    expect(
      annotationFromDraft(draft("bidirectional-arrow", [origin])),
    ).toBeNull();
    expect(annotationFromDraft(draft("draw", [origin]))).toBeNull();
    expect(annotationFromDraft(draft("measure", [origin]))).toBeNull();
    expect(annotationFromDraft(draft("circle", [origin]))).toBeNull();
    expect(annotationFromDraft(draft("rectangle", [origin]))).toBeNull();
    expect(annotationFromDraft(draft("polygon", [origin, east]))).toBeNull();
  });

  it("rejects tiny two-point paths and areas", () => {
    const nearby = destination(origin, 90, 0.4);
    expect(annotationFromDraft(draft("line", [origin, nearby]))).toBeNull();
    expect(annotationFromDraft(draft("circle", [origin, nearby]))).toBeNull();
    expect(
      annotationFromDraft(draft("rectangle", [origin, nearby])),
    ).toBeNull();
  });
});

describe("draft helpers", () => {
  it("appends the cursor for a live preview", () => {
    expect(previewCoordinates(draft("line", [origin], east))).toEqual([
      origin,
      east,
    ]);
    expect(previewCoordinates(null)).toEqual([]);
  });

  it("commits a trailing cursor when it has moved", () => {
    expect(committedDraftCoordinates(draft("draw", [origin], east))).toEqual([
      origin,
      east,
    ]);
    expect(committedDraftCoordinates(draft("draw", [origin], origin))).toEqual([
      origin,
    ]);
  });

  it("knows when a draft can finish", () => {
    expect(canFinishDraft(null)).toBe(false);
    expect(canFinishDraft(draft("marker", [origin]))).toBe(true);
    expect(canFinishDraft(draft("text", [origin]))).toBe(true);
    expect(canFinishDraft(draft("polygon", [origin, east]))).toBe(false);
    expect(canFinishDraft(draft("polygon", [origin, east], north))).toBe(true);
    expect(canFinishDraft(draft("polygon", [origin, east, north]))).toBe(true);
    expect(canFinishDraft(draft("circle", [origin], east))).toBe(true);
    expect(canFinishDraft(draft("line", [origin, east]))).toBe(true);
    expect(canFinishDraft(draft("draw", [origin], east))).toBe(true);
    expect(canFinishDraft(draft("trace", [origin, east]))).toBe(true);
  });

  it("enables finish while a drawing tool is active", () => {
    expect(canPressFinish("select", null)).toBe(false);
    expect(canPressFinish("polygon", null)).toBe(true);
    expect(
      canPressFinish("select", draft("polygon", [origin, east, north])),
    ).toBe(true);
  });

  it("reports minimum vertices per kind", () => {
    expect(minVerticesForKind("marker")).toBe(1);
    expect(minVerticesForKind("text")).toBe(1);
    expect(minVerticesForKind("polygon")).toBe(3);
    expect(minVerticesForKind("line")).toBe(2);
  });
});

describe("labels and collection updates", () => {
  const marker = annotationFromDraft(draft("marker", [origin]), {
    id: "a",
  })!;
  const line = annotationFromDraft(draft("line", [origin, east]), {
    id: "b",
  })!;

  it("places a label on every annotation kind", () => {
    const kinds: DraftAnnotation[] = [
      draft("marker", [origin]),
      draft("text", [origin]),
      draft("line", [origin, east]),
      draft("arrow", [origin, east]),
      draft("bidirectional-arrow", [origin, east]),
      draft("draw", [origin, east, north]),
      draft("trace", [origin, east, north]),
      draft("measure", [origin, east]),
      draft("circle", [origin, east]),
      draft("rectangle", [origin, west]),
      draft("polygon", [origin, east, north]),
    ];
    for (const item of kinds) {
      const annotation = annotationFromDraft(item, { id: item.kind });
      expect(annotation, item.kind).toBeTruthy();
      expect(labelAnchor(annotation!), item.kind).not.toBeNull();
      expect(annotation!.label.length).toBeGreaterThan(0);
    }
  });

  it("updates a color from the outside", () => {
    const next = setAnnotationColor(marker, "#ef4444");
    expect(next.style?.color).toBe("#ef4444");
    expect(marker.style).toBeUndefined();
    expect(
      updateAnnotationColor([marker, line], "a", "#22c55e")[0].style?.color,
    ).toBe("#22c55e");
    expect(cssColorForInput("#f00", "#2563eb")).toBe("#ff0000");
    expect(cssColorForInput("red", "#2563eb")).toBe("#2563eb");
  });

  it("clamps arrow stroke width", () => {
    const arrow = annotationFromDraft(draft("arrow", [origin, east]), {
      id: "arrow",
    })!;
    expect(isArrowAnnotation(arrow)).toBe(true);
    expect(
      setAnnotationStyle(arrow, { strokeWidth: 6 }).style?.strokeWidth,
    ).toBe(6);
    expect(
      setAnnotationStyle(arrow, { strokeWidth: 99 }).style?.strokeWidth,
    ).toBe(16);
    expect(
      setAnnotationStyle(arrow, { strokeWidth: 0 }).style?.strokeWidth,
    ).toBe(1);
  });

  it("updates a label from the outside", () => {
    const next = setAnnotationLabel(marker, "Home");
    expect(next.label).toBe("Home");
    expect(marker.label).toBe(DEFAULT_LABELS.marker);
    expect(updateAnnotationLabel([marker, line], "a", "HQ")[0].label).toBe(
      "HQ",
    );
  });

  it("upserts and removes annotations", () => {
    const updated = { ...line, label: "Route" };
    expect(upsertAnnotation([marker], line)).toEqual([marker, line]);
    expect(upsertAnnotation([marker, line], updated)).toEqual([
      marker,
      updated,
    ]);
    expect(removeAnnotation([marker, line], "b")).toEqual([marker]);
  });
});
