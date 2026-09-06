import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "./annotate-context";
import type { Annotation } from "../core/types";
import { useAnnotate } from "./use-annotate";

const marker: Annotation = {
  id: "m1",
  kind: "marker",
  label: "Marker",
  coordinate: [-73.9, 40.7],
};

const line: Annotation = {
  id: "l1",
  kind: "line",
  label: "Line",
  coordinates: [
    [-73.9, 40.7],
    [-73.8, 40.8],
  ],
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AnnotateProvider initialAnnotations={[marker]}>
      {children}
    </AnnotateProvider>
  );
}

describe("useAnnotate", () => {
  it("starts from provider state", () => {
    const { result } = renderHook(() => useAnnotate(), { wrapper });
    expect(result.current.annotations).toEqual([marker]);
    expect(result.current.tool).toBe("select");
    expect(result.current.draft).toBeNull();
  });

  it("adds, updates, labels, and deletes through the session", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }) => (
        <AnnotateProvider initialAnnotations={[marker]} onChange={onChange}>
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.onAdd(line);
    });
    expect(result.current.annotations).toHaveLength(2);
    expect(result.current.selectedId).toBe("l1");
    expect(onChange).toHaveBeenCalled();

    act(() => {
      result.current.setLabel("l1", "North line");
      result.current.setColor("l1", "#ef4444");
    });
    expect(
      result.current.annotations.find((item) => item.id === "l1")?.label,
    ).toBe("North line");
    expect(
      result.current.annotations.find((item) => item.id === "l1")?.style?.color,
    ).toBe("#ef4444");

    act(() => {
      result.current.onDelete("l1");
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual(["m1"]);
    expect(result.current.selectedId).toBeNull();
  });

  it("changes the active tool", () => {
    const { result } = renderHook(() => useAnnotate(), { wrapper });
    act(() => {
      result.current.setTool("polygon");
    });
    expect(result.current.tool).toBe("polygon");
  });
});
