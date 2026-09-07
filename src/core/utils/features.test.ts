import { describe, expect, it } from "vitest";
import type { Annotation, AnnotationKind, DraftAnnotation } from "../types";
import { annotationFromDraft } from "./annotations";
import { destination } from "./geo";
import {
  buildAnnotationFeatures,
  draftAreaCoordinates,
  draftPolygonPreview,
} from "./features";

const origin: [number, number] = [12, 55];
const edge = destination(origin, 45, 80);
const third = destination(edge, 180, 50);

function make(kind: AnnotationKind, coordinates: Array<[number, number]>) {
  return annotationFromDraft({ kind, coordinates }, { id: kind })!;
}

const annotations: Annotation[] = [
  make("draw", [origin, edge, third]),
  make("line", [origin, edge]),
  make("arrow", [origin, edge]),
  make("bidirectional-arrow", [origin, edge]),
  make("measure", [origin, edge]),
  make("circle", [origin, edge]),
  make("rectangle", [origin, edge]),
  make("polygon", [origin, edge, third]),
  make("marker", [origin]),
  make("text", [origin]),
];

describe("buildAnnotationFeatures", () => {
  const features = buildAnnotationFeatures({
    annotations,
    selectedId: "arrow",
  });

  it("emits a line feature for every path annotation", () => {
    const kinds = features.lines.features.map(
      (feature) => feature.properties?.kind,
    );
    expect(kinds).toEqual([
      "draw",
      "line",
      "arrow",
      "bidirectional-arrow",
      "measure",
    ]);
  });

  it("emits a fill feature for circle, rectangle, and polygon", () => {
    const kinds = features.fills.features.map(
      (feature) => feature.properties?.kind,
    );
    expect(kinds).toEqual(["circle", "rectangle", "polygon"]);
  });

  it("keeps area fills transparent until hover", () => {
    const idle = features.fills.features.map(
      (feature) => feature.properties?.fillOpacity,
    );
    expect(idle).toEqual([0, 0, 0]);
    const hovered = buildAnnotationFeatures({
      annotations,
      hoveredId: "polygon",
    });
    const polygon = hovered.fills.features.find(
      (feature) => feature.properties?.id === "polygon",
    );
    const circle = hovered.fills.features.find(
      (feature) => feature.properties?.id === "circle",
    );
    expect(polygon?.properties?.fillOpacity).toBe(0.18);
    expect(circle?.properties?.fillOpacity).toBe(0);
  });

  it("keeps markers and text out of line and fill sources", () => {
    expect(features.markers.map((marker) => marker.id)).toEqual(["marker"]);
    expect(
      features.lines.features.some(
        (feature) =>
          feature.properties?.kind === "marker" ||
          feature.properties?.kind === "text",
      ),
    ).toBe(false);
  });

  it("adds one arrow head and two bidirectional heads", () => {
    expect(
      features.arrows.filter((arrow) => arrow.id === "arrow"),
    ).toHaveLength(1);
    expect(
      features.arrows.filter((arrow) => arrow.id === "bidirectional-arrow"),
    ).toHaveLength(2);
    expect(
      features.arrows.find((arrow) => arrow.id === "arrow")?.direction,
    ).toBe("end");
    expect(
      features.arrows
        .filter((arrow) => arrow.id === "bidirectional-arrow")
        .map((arrow) => arrow.direction),
    ).toEqual(["end", "start"]);
    expect(features.arrows.every((arrow) => arrow.size === 26)).toBe(true);
  });

  it("scales the shaft and heads together from strokeWidth", () => {
    const thick = buildAnnotationFeatures({
      annotations: [
        { ...make("arrow", [origin, edge]), style: { strokeWidth: 6 } },
        {
          ...make("bidirectional-arrow", [origin, edge]),
          style: { strokeWidth: 6 },
        },
      ],
    });
    const thin = buildAnnotationFeatures({
      annotations: [
        { ...make("arrow", [origin, edge]), style: { strokeWidth: 1 } },
      ],
    });
    expect(
      thick.lines.features.map((feature) => feature.properties?.strokeWidth),
    ).toEqual([6, 6]);
    expect(thick.arrows.map((arrow) => arrow.size)).toEqual([52, 52, 52]);
    expect(thin.arrows[0]?.size).toBe(12);
  });

  it("samples measure annotations onto a point layer", () => {
    expect(features.samples.features.length).toBeGreaterThan(5);
    expect(features.samples.features[0]?.properties?.kind).toBe("measure");
  });

  it("marks the selected annotation", () => {
    const arrow = features.lines.features.find(
      (feature) => feature.properties?.id === "arrow",
    );
    expect(arrow?.properties?.selected).toBe(true);
    expect(features.arrows.find((item) => item.id === "arrow")?.selected).toBe(
      true,
    );
  });

  it("renders live drafts for path and area tools", () => {
    const lineDraft: DraftAnnotation = {
      kind: "line",
      coordinates: [origin],
      cursor: edge,
    };
    const circleDraft: DraftAnnotation = {
      kind: "circle",
      coordinates: [origin],
      cursor: edge,
    };
    const pathDraft = buildAnnotationFeatures({
      annotations: [],
      draft: lineDraft,
    });
    const areaDraft = buildAnnotationFeatures({
      annotations: [],
      draft: circleDraft,
    });
    expect(pathDraft.lines.features[0]?.properties?.id).toBe("draft");
    expect(areaDraft.fills.features[0]?.properties?.kind).toBe("circle");
    expect(draftAreaCoordinates(circleDraft).length).toBeGreaterThan(4);
  });

  it("uses a dotted close from the cursor back to the first polygon vertex", () => {
    const preview = draftPolygonPreview({
      kind: "polygon",
      coordinates: [origin, edge],
      cursor: third,
    });
    expect(preview.solid).toEqual([
      [origin, edge],
      [edge, third],
    ]);
    expect(preview.dashed).toEqual([[third, origin]]);
    const features = buildAnnotationFeatures({
      annotations: [],
      draft: {
        kind: "polygon",
        coordinates: [origin, edge],
        cursor: third,
      },
    });
    expect(features.dashed.features[0]?.geometry.coordinates).toEqual([
      third,
      origin,
    ]);
  });

  it("shows a bounds box for a hovered drawing", () => {
    const features = buildAnnotationFeatures({
      annotations,
      hoveredId: "draw",
    });
    expect(features.bounds.features[0]?.properties?.kind).toBe("bounds");
    expect(features.bounds.features[0]?.properties?.id).toBe("draw");
  });
});
