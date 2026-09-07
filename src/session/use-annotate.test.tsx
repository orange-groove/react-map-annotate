import { act, renderHook } from "@testing-library/react";
import { useState, type ReactNode } from "react";
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
      result.current.setStyle("l1", { fontFamily: "Georgia, serif" });
    });
    expect(
      result.current.annotations.find((item) => item.id === "l1")?.style
        ?.fontFamily,
    ).toBe("Georgia, serif");

    act(() => {
      result.current.onDelete("l1");
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual(["m1"]);
    expect(result.current.selectedId).toBeNull();
  });

  it("undoes and redoes annotation changes", () => {
    const { result } = renderHook(() => useAnnotate(), { wrapper });
    act(() => {
      result.current.onAdd(line);
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual([
      "m1",
      "l1",
    ]);
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual(["m1"]);
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual([
      "m1",
      "l1",
    ]);
  });

  it("keeps undo available when the host owns annotation state", () => {
    function Controlled({ children }: { children: ReactNode }) {
      const [annotations, setAnnotations] = useState<Annotation[]>([marker]);
      return (
        <AnnotateProvider annotations={annotations} onChange={setAnnotations}>
          {children}
        </AnnotateProvider>
      );
    }
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: Controlled,
    });
    act(() => {
      result.current.onAdd(line);
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual([
      "m1",
      "l1",
    ]);
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual(["m1"]);
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.annotations.map((item) => item.id)).toEqual([
      "m1",
      "l1",
    ]);
  });

  it("coalesces live edits into a single undo step", () => {
    const { result } = renderHook(() => useAnnotate(), { wrapper });
    act(() => {
      result.current.onAdd(line);
    });
    act(() => {
      result.current.onUpdate({
        ...line,
        coordinates: [
          [-73.9, 40.7],
          [-73.7, 40.8],
        ],
      });
      result.current.onUpdate({
        ...line,
        coordinates: [
          [-73.9, 40.7],
          [-73.6, 40.8],
        ],
      });
      result.current.endEdit();
    });
    act(() => {
      result.current.undo();
    });
    const undone = result.current.annotations.find((item) => item.id === "l1");
    expect(undone?.kind).toBe("line");
    if (undone?.kind !== "line") throw new Error("expected line");
    expect(undone.coordinates).toEqual([
      [-73.9, 40.7],
      [-73.8, 40.8],
    ]);
  });

  it("removes a selected vertex instead of the whole annotation", () => {
    const polygon: Annotation = {
      id: "p1",
      kind: "polygon",
      label: "Lot",
      coordinates: [
        [-73.9, 40.7],
        [-73.8, 40.7],
        [-73.8, 40.8],
        [-73.9, 40.8],
        [-73.9, 40.7],
      ],
    };
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }) => (
        <AnnotateProvider initialAnnotations={[polygon]}>
          {children}
        </AnnotateProvider>
      ),
    });
    act(() => {
      result.current.setSelectedId("p1");
      result.current.setSelectedVertexIndex(1);
      result.current.removeSelected();
    });
    const next = result.current.annotations[0];
    expect(next?.kind).toBe("polygon");
    if (next?.kind !== "polygon") throw new Error("expected polygon");
    expect(next.coordinates).toHaveLength(4);
    act(() => {
      result.current.undo();
    });
    expect(result.current.annotations[0]?.kind).toBe("polygon");
    if (result.current.annotations[0]?.kind !== "polygon") {
      throw new Error("expected polygon");
    }
    expect(result.current.annotations[0].coordinates).toHaveLength(5);
  });

  it("changes the active tool", () => {
    const { result } = renderHook(() => useAnnotate(), { wrapper });
    act(() => {
      result.current.setTool("polygon");
    });
    expect(result.current.tool).toBe("polygon");
  });
});
