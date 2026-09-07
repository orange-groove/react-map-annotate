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

  it("copies the selection with Cmd+C", () => {
    const copySelected = vi.fn(() => true);
    const event = new KeyboardEvent("keydown", {
      key: "c",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    handleMapKeyDown(event, {
      latest: latest({ selectedId: "a1" }),
      finishDrawing: vi.fn(),
      copySelected,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(copySelected).toHaveBeenCalled();
  });

  it("pastes with Cmd+V", () => {
    const pasteAtPointer = vi.fn();
    const event = new KeyboardEvent("keydown", {
      key: "v",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    handleMapKeyDown(event, {
      latest: latest({ selectedId: "a1" }),
      finishDrawing: vi.fn(),
      pasteAtPointer,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(pasteAtPointer).toHaveBeenCalled();
  });

  it("duplicates the selection with Cmd+D", () => {
    const duplicateSelected = vi.fn(() => true);
    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    handleMapKeyDown(event, {
      latest: latest({ selectedId: "a1" }),
      finishDrawing: vi.fn(),
      duplicateSelected,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(duplicateSelected).toHaveBeenCalled();
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
