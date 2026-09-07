import { describe, expect, it, vi } from "vitest";
import type { MapDrawingLatest } from "./use-map-drawing";
import { handleMapKeyDown } from "./use-map-keyboard";

function latest(overrides: Partial<MapDrawingLatest> = {}): MapDrawingLatest {
  return {
    annotations: [],
    draft: null,
    tool: "select",
    selectedId: null,
    defaultColor: "#2563eb",
    sampleIntervalMeters: 10,
    ...overrides,
  };
}

function key(name: string) {
  return new KeyboardEvent("keydown", {
    key: name,
    bubbles: true,
    cancelable: true,
  });
}

describe("handleMapKeyDown", () => {
  it("finishes the draft on Enter", () => {
    const finishDrawing = vi.fn();
    const event = key("Enter");
    handleMapKeyDown(event, {
      latest: latest({
        tool: "polygon",
        draft: {
          kind: "polygon",
          coordinates: [
            [-73.9, 40.7],
            [-73.8, 40.8],
          ],
          cursor: [-73.7, 40.7],
        },
      }),
      finishDrawing,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(finishDrawing).toHaveBeenCalled();
  });

  it("finishes the draft on Escape", () => {
    const finishDrawing = vi.fn();
    const event = key("Escape");
    handleMapKeyDown(event, {
      latest: latest({
        tool: "circle",
        draft: {
          kind: "circle",
          coordinates: [[-73.9, 40.7]],
          cursor: [-73.8, 40.8],
        },
      }),
      finishDrawing,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(finishDrawing).toHaveBeenCalled();
  });

  it("finishes when a drawing tool is active even without a draft", () => {
    const finishDrawing = vi.fn();
    handleMapKeyDown(key("Enter"), {
      latest: latest({ tool: "polygon" }),
      finishDrawing,
    });
    expect(finishDrawing).toHaveBeenCalled();
  });
});
