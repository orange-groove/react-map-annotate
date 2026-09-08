import { describe, expect, it } from "vitest";
import {
  LAYER_PREFIX,
  MAPBOX_TERRAIN_DEM,
  isAnnotateLayerId,
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
  isPointTool,
  isTraceTool,
  isIdleTool,
  toggleAnnotateTool,
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
    expect(isDragTool("circle")).toBe(true);
    expect(isDragTool("rectangle")).toBe(true);
    expect(isDragTool("line")).toBe(false);
    expect(isClickVertexTool("polygon")).toBe(true);
    expect(isClickVertexTool("measure")).toBe(true);
    expect(isClickVertexTool("draw")).toBe(false);
    expect(isPointTool("text")).toBe(true);
    expect(isPointTool("marker")).toBe(true);
    expect(isPointTool("line")).toBe(false);
  });

  it("toggles an active tool back to pan", () => {
    expect(isIdleTool("pan")).toBe(true);
    expect(isIdleTool("select")).toBe(false);
    expect(toggleAnnotateTool("select", "select")).toBe("pan");
    expect(toggleAnnotateTool("pan", "select")).toBe("select");
    expect(toggleAnnotateTool("line", "polygon")).toBe("polygon");
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
