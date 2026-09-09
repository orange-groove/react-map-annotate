import { act, renderHook } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "./annotate-context";
import type { Annotation, ChangeMeta, PathAnnotation } from "../core/types";
import { useAnnotate } from "./use-annotate";

type CommitCall = [Annotation[], ChangeMeta];

const line: PathAnnotation = {
  id: "l1",
  kind: "line",
  label: "Line",
  coordinates: [
    [-73.9, 40.7],
    [-73.8, 40.8],
  ],
};

function moved(offset: number): PathAnnotation {
  return {
    ...line,
    coordinates: [
      [-73.9, 40.7],
      [-73.8 + offset, 40.8],
    ],
  };
}

describe("live edits versus commits", () => {
  it("reports every pointermove as live and the gesture end as one commit", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider
          initialAnnotations={[line]}
          onChange={onChange}
          onCommit={onCommit}
        >
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.onUpdate(moved(0.01));
      result.current.onUpdate(moved(0.02));
      result.current.onUpdate(moved(0.03));
    });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(
      (onChange.mock.calls as CommitCall[]).every(
        ([, meta]) => meta.reason === "live",
      ),
    ).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      result.current.endEdit();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [annotations, meta] = onCommit.mock.calls[0] as CommitCall;
    expect(meta).toEqual({ reason: "commit", cause: "edit", ids: ["l1"] });
    expect(annotations[0]).toEqual(moved(0.03));
  });

  it("exposes isEditing for the span of a gesture", () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider initialAnnotations={[line]}>
          {children}
        </AnnotateProvider>
      ),
    });

    expect(result.current.isEditing).toBe(false);
    act(() => {
      result.current.onUpdate(moved(0.01));
    });
    expect(result.current.isEditing).toBe(true);
    act(() => {
      result.current.endEdit();
    });
    expect(result.current.isEditing).toBe(false);
  });

  it("tags discrete changes with a cause and the ids they touched", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider initialAnnotations={[line]} onCommit={onCommit}>
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.setColor("l1", "#ff0000");
    });
    act(() => {
      result.current.setLabel("l1", "North fence");
    });
    act(() => {
      result.current.onDelete("l1");
    });

    expect(
      (onCommit.mock.calls as CommitCall[]).map(([, meta]) => meta),
    ).toEqual([
      { reason: "commit", cause: "style", ids: ["l1"] },
      { reason: "commit", cause: "label", ids: ["l1"] },
      { reason: "commit", cause: "delete", ids: ["l1"] },
    ]);
  });
});

describe("controlled mode", () => {
  function ControlledHarness({
    remap,
  }: {
    remap?: (annotations: Annotation[]) => Annotation[];
  }) {
    return function Wrapper({ children }: { children: ReactNode }) {
      const [annotations, setAnnotations] = useState<Annotation[]>([line]);
      return (
        <AnnotateProvider
          annotations={annotations}
          onChange={(next) => setAnnotations(remap ? remap(next) : next)}
        >
          {children}
        </AnnotateProvider>
      );
    };
  }

  it("keeps undo history when the host echoes our own array back", () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ControlledHarness({}),
    });

    act(() => {
      result.current.onUpdate(moved(0.01));
    });
    act(() => {
      result.current.endEdit();
    });

    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(result.current.annotations[0]).toEqual(line);
  });

  it("survives a host that remaps colour on the way back", () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ControlledHarness({
        remap: (annotations) =>
          annotations.map((annotation) => ({
            ...annotation,
            style: { ...annotation.style, color: "rgba(255,0,0,0.8)" },
          })),
      }),
    });

    act(() => {
      result.current.onUpdate(moved(0.02));
    });
    act(() => {
      result.current.endEdit();
    });

    // The remapped colour is adopted, the dragged geometry is not clobbered,
    // and undo still points at the pre-drag state.
    expect(result.current.annotations[0]?.style?.color).toBe(
      "rgba(255,0,0,0.8)",
    );
    expect(
      (result.current.annotations[0] as typeof line).coordinates[1],
    ).toEqual(moved(0.02).coordinates[1]);
    expect(result.current.canUndo).toBe(true);
  });

  it("ignores an external array that lands mid-gesture", () => {
    const { result, rerender } = renderHook(
      ({ annotations }: { annotations: Annotation[] }) => {
        void annotations;
        return useAnnotate();
      },
      {
        initialProps: { annotations: [line] },
        wrapper: ({
          children,
          annotations,
        }: {
          children: ReactNode;
          annotations?: Annotation[];
        }) => (
          <AnnotateProvider annotations={annotations ?? [line]}>
            {children}
          </AnnotateProvider>
        ),
      },
    );

    act(() => {
      result.current.onUpdate(moved(0.05));
    });
    rerender({ annotations: [{ ...line, label: "From the server" }] });

    expect(
      (result.current.annotations[0] as typeof line).coordinates[1],
    ).toEqual(moved(0.05).coordinates[1]);
  });
});
