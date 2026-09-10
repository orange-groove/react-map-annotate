import { describe, expect, it } from "vitest";
import {
  DUAL_GESTURE_TOOLS,
  LAYER_PREFIX,
  MAPBOX_TERRAIN_DEM,
  isAnnotateLayerId,
  isClickVertexTool,
  isDragTool,
  isDualGestureTool,
  isDrawingTool,
  isPointTool,
  isTraceTool,
  isIdleTool,
  toggleAnnotateTool,
  emptyClickClearsSelection,
} from "./constants";

describe("tool helpers", () => {
  it("treats pan and select as non-drawing tools", () => {
    expect(isDrawingTool("select")).toBe(false);
    expect(isDrawingTool("pan")).toBe(false);
    expect(isDrawingTool(undefined)).toBe(false);
    expect(isDrawingTool("line")).toBe(true);
    expect(isDrawingTool("trace")).toBe(true);
    expect(isDrawingTool("marker")).toBe(true);
    expect(isDrawingTool("text")).toBe(true);
    expect(isTraceTool("trace")).toBe(true);
    expect(isTraceTool("line")).toBe(false);
  });

  it("classifies drag and click-vertex tools", () => {
    expect(isDragTool("draw")).toBe(true);
    expect(isDragTool("trace")).toBe(false);
    expect(isClickVertexTool("polygon")).toBe(true);
    expect(isClickVertexTool("draw")).toBe(false);
    expect(isPointTool("text")).toBe(true);
    expect(isPointTool("marker")).toBe(true);
    expect(isPointTool("line")).toBe(false);
  });

  it("hands the two-point shapes to whichever gesture drawMode names", () => {
    for (const tool of DUAL_GESTURE_TOOLS) {
      expect(isDualGestureTool(tool)).toBe(true);
      // Two clicks by default.
      expect(isClickVertexTool(tool)).toBe(true);
      expect(isDragTool(tool)).toBe(false);
      expect(isClickVertexTool(tool, "drag")).toBe(false);
      expect(isDragTool(tool, "drag")).toBe(true);
    }
    expect(isDualGestureTool("polygon")).toBe(false);
    expect(isDualGestureTool("draw")).toBe(false);
  });

  it("keeps freehand a drag and polygon click-per-vertex in either mode", () => {
    expect(isDragTool("draw", "click")).toBe(true);
    expect(isDragTool("draw", "drag")).toBe(true);
    expect(isClickVertexTool("polygon", "click")).toBe(true);
    expect(isClickVertexTool("polygon", "drag")).toBe(true);
  });

  it("toggles an active tool back to pan", () => {
    expect(isIdleTool("pan")).toBe(true);
    expect(isIdleTool("select")).toBe(false);
    expect(toggleAnnotateTool("select", "select")).toBe("pan");
    expect(toggleAnnotateTool("pan", "select")).toBe("select");
    expect(toggleAnnotateTool("line", "polygon")).toBe("polygon");
  });

  it("clears selection on an empty pan or select click", () => {
    expect(emptyClickClearsSelection("pan")).toBe(true);
    expect(emptyClickClearsSelection("select")).toBe(true);
    expect(emptyClickClearsSelection("pan", true)).toBe(false);
    expect(emptyClickClearsSelection("polygon")).toBe(false);
    expect(emptyClickClearsSelection("pan", false, { kind: "line" })).toBe(
      false,
    );
  });
});

describe("isAnnotateLayerId", () => {
  it("matches the library layer prefix", () => {
    expect(isAnnotateLayerId(`${LAYER_PREFIX}-line`)).toBe(true);
    expect(isAnnotateLayerId("active-route-line")).toBe(false);
    expect(isAnnotateLayerId(undefined)).toBe(false);
    expect(MAPBOX_TERRAIN_DEM).toContain("mapbox-terrain-dem");
  });
});
