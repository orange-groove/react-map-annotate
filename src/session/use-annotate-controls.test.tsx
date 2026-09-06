import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AnnotateProvider } from "./annotate-context";
import type { Annotation } from "../core/types";
import { useAnnotateItems, useAnnotateTools } from "./use-annotate-controls";

const line: Annotation = {
  id: "l1",
  kind: "line",
  label: "North fence",
  coordinates: [
    [-73.9, 40.7],
    [-73.8, 40.8],
  ],
  style: { color: "#2563eb" },
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AnnotateProvider initialAnnotations={[line]}>{children}</AnnotateProvider>
  );
}

describe("useAnnotateTools", () => {
  it("maps tools to selectable items", () => {
    const { result } = renderHook(() => useAnnotateTools(["line", "polygon"]), {
      wrapper,
    });
    expect(result.current.items.map((item) => item.id)).toEqual([
      "line",
      "polygon",
    ]);
    expect(result.current.items[0]?.label).toBe("Line");
    act(() => {
      result.current.items[1]?.select();
    });
    expect(result.current.tool).toBe("polygon");
    expect(result.current.items[1]?.active).toBe(true);
    expect(result.current.canFinish).toBe(true);
  });
});

describe("useAnnotateItems", () => {
  it("exposes label, color, and remove helpers", () => {
    const { result } = renderHook(() => useAnnotateItems(), { wrapper });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.kindLabel).toBe("Line");
    expect(result.current[0]?.color).toBe("#2563eb");
    act(() => {
      result.current[0]?.setLabel("South fence");
      result.current[0]?.setColor("#ef4444");
    });
    expect(result.current[0]?.label).toBe("South fence");
    expect(result.current[0]?.color).toBe("#ef4444");
    act(() => {
      result.current[0]?.remove();
    });
    expect(result.current).toHaveLength(0);
  });
});
