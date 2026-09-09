import { act, renderHook } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "./annotate-context";
import type { Annotation, ChangeMeta, PathAnnotation } from "../core/types";
import { useAnnotate } from "./use-annotate";
import { useLiveAnnotations } from "./live-edits";

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

function endOf(annotation: Annotation | undefined) {
  return (annotation as PathAnnotation | undefined)?.coordinates[1];
}

/** Lets the live store's rAF coalescing land. */
async function nextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

describe("live edits versus commits", () => {
  it("keeps a drag out of React state, out of onChange, and out of onCommit", async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useAnnotate();
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AnnotateProvider
            initialAnnotations={[line]}
            onChange={onChange}
            onCommit={onCommit}
          >
            {children}
          </AnnotateProvider>
        ),
      },
    );

    const before = result.current.annotations;
    const rendersBeforeDrag = renders;

    act(() => {
      result.current.beginEdit();
      result.current.onUpdate(moved(0.01));
      result.current.onUpdate(moved(0.02));
      result.current.onUpdate(moved(0.03));
    });
    await nextFrame();

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    // The session array is untouched, by reference, for the whole gesture.
    expect(result.current.annotations).toBe(before);
    // Only the one render that flipped isEditing.
    expect(renders - rendersBeforeDrag).toBeLessThanOrEqual(1);
  });

  it("paints live geometry before anything is committed", async () => {
    const { result } = renderHook(
      () => {
        const session = useAnnotate();
        return { session, painted: useLiveAnnotations(session.annotations) };
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AnnotateProvider initialAnnotations={[line]}>
            {children}
          </AnnotateProvider>
        ),
      },
    );

    act(() => {
      result.current.session.beginEdit();
      result.current.session.onUpdate(moved(0.04));
    });
    await nextFrame();

    expect(endOf(result.current.painted[0])).toEqual(
      moved(0.04).coordinates[1],
    );
    expect(endOf(result.current.session.annotations[0])).toEqual(
      line.coordinates[1],
    );
  });

  it("lands the whole gesture in one commit", async () => {
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
      result.current.beginEdit();
      result.current.onUpdate(moved(0.01));
      result.current.onUpdate(moved(0.02));
      result.current.onUpdate(moved(0.03));
    });
    await nextFrame();
    act(() => {
      result.current.endEdit();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [annotations, meta] = onCommit.mock.calls[0] as CommitCall;
    expect(meta).toEqual({ reason: "commit", cause: "edit", ids: ["l1"] });
    expect(endOf(annotations[0])).toEqual(moved(0.03).coordinates[1]);
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.03).coordinates[1],
    );
  });

  it("undoes a whole gesture as one step", async () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider initialAnnotations={[line]}>
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.beginEdit();
      result.current.onUpdate(moved(0.01));
      result.current.onUpdate(moved(0.02));
    });
    await nextFrame();
    act(() => {
      result.current.endEdit();
    });
    act(() => {
      result.current.undo();
    });

    expect(endOf(result.current.annotations[0])).toEqual(line.coordinates[1]);
    expect(result.current.canUndo).toBe(false);
  });

  it("emits coalesced live changes only when asked", async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider
          initialAnnotations={[line]}
          onChange={onChange}
          emitLiveChanges
        >
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.beginEdit();
      result.current.onUpdate(moved(0.01));
      result.current.onUpdate(moved(0.02));
      result.current.onUpdate(moved(0.03));
    });
    await nextFrame();

    // Three moves in one frame, one notification.
    expect(onChange).toHaveBeenCalledTimes(1);
    const [annotations, meta] = onChange.mock.calls[0] as CommitCall;
    expect(meta.reason).toBe("live");
    expect(endOf(annotations[0])).toEqual(moved(0.03).coordinates[1]);
  });

  it("commits a programmatic update straight away", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider initialAnnotations={[line]} onCommit={onCommit}>
          {children}
        </AnnotateProvider>
      ),
    });

    // No beginEdit, so this is not a gesture: it lands in state now.
    act(() => {
      result.current.onUpdate(moved(0.09));
    });

    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.09).coordinates[1],
    );
    expect(onCommit).toHaveBeenCalledTimes(1);
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
      result.current.beginEdit();
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

  it("applies a style change on top of an unfinished gesture", async () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AnnotateProvider initialAnnotations={[line]}>
          {children}
        </AnnotateProvider>
      ),
    });

    act(() => {
      result.current.beginEdit();
      result.current.onUpdate(moved(0.02));
    });
    await nextFrame();
    act(() => {
      result.current.setColor("l1", "#ff0000");
    });

    expect(result.current.annotations[0]?.style?.color).toBe("#ff0000");
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.02).coordinates[1],
    );
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

  it("keeps undo history when the host echoes our own array back", async () => {
    const { result } = renderHook(() => useAnnotate(), {
      wrapper: ControlledHarness({}),
    });

    act(() => {
      result.current.beginEdit();
      result.current.onUpdate(moved(0.01));
    });
    await nextFrame();
    act(() => {
      result.current.endEdit();
    });

    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(endOf(result.current.annotations[0])).toEqual(line.coordinates[1]);
  });

  it("survives a host that remaps colour on the way back", async () => {
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
      result.current.beginEdit();
      result.current.onUpdate(moved(0.02));
    });
    await nextFrame();
    act(() => {
      result.current.endEdit();
    });

    // The remapped colour is adopted, the dragged geometry is not clobbered,
    // and undo still points at the pre-drag state.
    expect(result.current.annotations[0]?.style?.color).toBe(
      "rgba(255,0,0,0.8)",
    );
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.02).coordinates[1],
    );
    expect(result.current.canUndo).toBe(true);
  });

  it("ignores an external array that lands mid-gesture", async () => {
    const { result, rerender } = renderHook(
      ({ annotations }: { annotations: Annotation[] }) => {
        void annotations;
        const session = useAnnotate();
        return { session, painted: useLiveAnnotations(session.annotations) };
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
      result.current.session.beginEdit();
      result.current.session.onUpdate(moved(0.05));
    });
    await nextFrame();
    rerender({ annotations: [{ ...line, label: "From the server" }] });

    // The drag owns the map until it ends.
    expect(endOf(result.current.painted[0])).toEqual(
      moved(0.05).coordinates[1],
    );

    act(() => {
      result.current.session.endEdit();
    });
    expect(endOf(result.current.session.annotations[0])).toEqual(
      moved(0.05).coordinates[1],
    );
  });
});
