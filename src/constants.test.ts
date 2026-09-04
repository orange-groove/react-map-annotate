import { describe, expect, it } from "vitest";
import {
  LAYER_PREFIX,
  isAnnotateLayerId,
  isClickVertexTool,
  isDragTool,
  isDrawingTool,
} from "./constants";

describe("tool helpers", () => {
  it("treats every drawing tool as active except select", () => {
    expect(isDrawingTool("select")).toBe(false);
    expect(isDrawingTool(undefined)).toBe(false);
    expect(isDrawingTool("line")).toBe(true);
    expect(isDrawingTool("marker")).toBe(true);
  });

  it("classifies drag and click-vertex tools", () => {
    expect(isDragTool("draw")).toBe(true);
    expect(isDragTool("circle")).toBe(true);
    expect(isDragTool("rectangle")).toBe(true);
    expect(isDragTool("line")).toBe(false);
    expect(isClickVertexTool("polygon")).toBe(true);
    expect(isClickVertexTool("measure")).toBe(true);
    expect(isClickVertexTool("draw")).toBe(false);
  });
});

describe("isAnnotateLayerId", () => {
  it("matches the library layer prefix", () => {
    expect(isAnnotateLayerId(`${LAYER_PREFIX}-line`)).toBe(true);
    expect(isAnnotateLayerId("active-route-line")).toBe(false);
    expect(isAnnotateLayerId(undefined)).toBe(false);
  });
});
