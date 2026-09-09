import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  Annotation,
  AreaAnnotation,
  MarkerAnnotation,
  PathAnnotation,
} from "../core/types";
import { buildAnnotationFeatures } from "../core/utils/features";
import { useAnnotationFeatures } from "./use-annotation-features";

const line: PathAnnotation = {
  id: "line-1",
  kind: "line",
  label: "Line",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};

const polygon: AreaAnnotation = {
  id: "poly-1",
  kind: "polygon",
  label: "Poly",
  coordinates: [
    [2, 2],
    [3, 2],
    [3, 3],
    [2, 2],
  ],
};

const marker: MarkerAnnotation = {
  id: "pin-1",
  kind: "marker",
  label: "Pin",
  coordinate: [4, 4],
};

function dragged(): PathAnnotation {
  return {
    ...line,
    coordinates: [
      [0, 0],
      [1.5, 1.5],
    ],
  };
}

describe("buildAnnotationFeatures memoisation", () => {
  it("rebuilds only the annotation that changed", () => {
    const annotations = [line, polygon, marker];
    const first = buildAnnotationFeatures({ annotations });
    const second = buildAnnotationFeatures({
      annotations: [dragged(), polygon, marker],
    });

    expect(second.lines.features[0]).not.toBe(first.lines.features[0]);
    expect(second.fills.features[0]).toBe(first.fills.features[0]);
    expect(second.markers[0]).toBe(first.markers[0]);
  });

  it("rebuilds an annotation when its selection or hover state changes", () => {
    const annotations = [line];
    const idle = buildAnnotationFeatures({ annotations });
    const selected = buildAnnotationFeatures({
      annotations,
      selectedId: "line-1",
    });

    expect(selected.lines.features[0]).not.toBe(idle.lines.features[0]);
    expect(selected.lines.features[0]?.properties?.selected).toBe(true);
  });
});

describe("useAnnotationFeatures", () => {
  it("hands back the same collection for sources that did not change", () => {
    const { result, rerender } = renderHook(
      (annotations: Annotation[]) => useAnnotationFeatures({ annotations }),
      { initialProps: [line, polygon, marker] },
    );

    const before = result.current;
    rerender([dragged(), polygon, marker]);

    // Only the line source is re-uploaded; the rest are the same object, so
    // the map binding skips them.
    expect(result.current.lines).not.toBe(before.lines);
    expect(result.current.fills).toBe(before.fills);
    expect(result.current.dashed).toBe(before.dashed);
    expect(result.current.bounds).toBe(before.bounds);
    expect(result.current.samples).toBe(before.samples);
    expect(result.current.markers).toBe(before.markers);
  });

  it("keeps every collection when nothing changed", () => {
    const annotations = [line, polygon, marker];
    const { result, rerender } = renderHook(
      (items: Annotation[]) => useAnnotationFeatures({ annotations: items }),
      { initialProps: annotations },
    );

    const before = result.current;
    rerender([...annotations]);

    expect(result.current.lines).toBe(before.lines);
    expect(result.current.fills).toBe(before.fills);
    expect(result.current.markers).toBe(before.markers);
  });
});
