import { describe, expect, it, vi } from "vitest";
import type { PathAnnotation } from "../core/types";
import {
  peekAnnotationClipboard,
  peekAnnotationClipboardItems,
  writeAnnotationClipboard,
} from "../core/utils/clipboard";
import {
  copySelectedAnnotation,
  resolveAnnotationContextMenu,
} from "./clipboard-actions";
import type { MapDrawingLatest } from "./use-map-drawing";

const line: PathAnnotation = {
  id: "line-1",
  kind: "line",
  label: "Fence",
  coordinates: [
    [-73.99, 40.75],
    [-73.98, 40.75],
  ],
};

function latest(overrides: Partial<MapDrawingLatest> = {}): MapDrawingLatest {
  return {
    annotations: [line],
    draft: null,
    tool: "select",
    selectedId: "line-1",
    defaultColor: "#2563eb",
    sampleIntervalMeters: 10,
    ...overrides,
  };
}

describe("copySelectedAnnotation", () => {
  it("writes the selected annotation to the clipboard", () => {
    expect(copySelectedAnnotation(latest())).toBe(true);
    expect(peekAnnotationClipboard()).toMatchObject({ id: "line-1" });
  });

  it("does nothing without a selection", () => {
    writeAnnotationClipboard(line);
    expect(copySelectedAnnotation(latest({ selectedId: null }))).toBe(false);
  });

  it("copies every selected annotation", () => {
    const other: PathAnnotation = {
      ...line,
      id: "line-2",
      label: "South",
    };
    expect(
      copySelectedAnnotation(
        latest({
          annotations: [line, other],
          selectedId: "line-2",
          selectedIds: ["line-1", "line-2"],
        }),
      ),
    ).toBe(true);
    expect(peekAnnotationClipboardItems().map((item) => item.id)).toEqual([
      "line-1",
      "line-2",
    ]);
  });
});

describe("resolveAnnotationContextMenu", () => {
  it("opens a menu on the hit annotation without duplicating it", () => {
    const onAdd = vi.fn();
    const canvas = document.createElement("div");
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 10,
    });
    Object.defineProperty(event, "target", { value: canvas });
    const menu = resolveAnnotationContextMenu(event, {
      latest: latest({ onAdd }),
      map: {
        getCanvas: () => canvas,
        project: ({ lng, lat }: { lng: number; lat: number }) => ({
          x: lng * 1000,
          y: lat * 1000,
        }),
        unproject: ([x, y]: [number, number]) => ({
          lng: x / 1000,
          lat: y / 1000,
        }),
        queryRenderedFeatures: () => [{ properties: { id: "line-1" } }],
        getLayer: () => ({}),
      } as never,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(onAdd).not.toHaveBeenCalled();
    expect(menu).toMatchObject({
      x: 40,
      y: 10,
      annotationId: "line-1",
    });
  });
});
