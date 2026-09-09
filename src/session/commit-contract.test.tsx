import { act, renderHook } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "./annotate-context";
import type { Annotation, ChangeMeta, PathAnnotation } from "../core/types";
import type { AnnotateSession } from "./annotate-context";
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

  interface HostControl {
    /** A change the host itself makes: a load, a server push, its own undo. */
    push: (annotations: Annotation[]) => void;
    /** A re-render for some unrelated reason. */
    touch: () => void;
    /** Applies a deferred commit, for a host whose store lands out of band. */
    flush: () => void;
    commits: Annotation[][];
  }

  /**
   * A host that keeps annotations in its own shape, remaps on the way in, and
   * persists from `onCommit` alone. Every render produces a new array, so
   * nothing it hands back is ever referentially ours.
   */
  function remappingHost({
    keepGeometry = false,
    defer = false,
  }: { keepGeometry?: boolean; defer?: boolean } = {}) {
    const control: HostControl = {
      push: () => undefined,
      touch: () => undefined,
      flush: () => undefined,
      commits: [],
    };
    function Wrapper({ children }: { children: ReactNode }) {
      const [stored, setStored] = useState<Annotation[]>([line]);
      const [, force] = useState(0);
      control.push = setStored;
      control.touch = () => force((count) => count + 1);
      return (
        <AnnotateProvider
          annotations={stored.map((annotation) => ({
            ...annotation,
            data: { hostId: annotation.id },
          }))}
          onCommit={(next) => {
            control.commits.push(next);
            // A merge that keeps the host's own geometry never catches up.
            if (keepGeometry) return;
            const apply = () =>
              setStored(next.map((annotation) => ({ ...annotation })));
            if (defer) control.flush = apply;
            else apply();
          }}
        >
          {children}
        </AnnotateProvider>
      );
    }
    return { control, Wrapper };
  }

  async function drag(session: () => AnnotateSession, offset: number) {
    act(() => {
      session().beginEdit();
      session().onUpdate(moved(offset));
    });
    await nextFrame();
    act(() => {
      session().endEdit();
    });
  }

  it("does not snap back for a host that remaps instead of echoing", async () => {
    const { control, Wrapper } = remappingHost();
    const { result } = renderHook(() => useAnnotate(), { wrapper: Wrapper });

    await drag(() => result.current, 0.03);

    expect(control.commits).toHaveLength(1);
    expect(endOf(control.commits[0]?.[0])).toEqual(moved(0.03).coordinates[1]);
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.03).coordinates[1],
    );

    // Whatever else makes the host re-render, the commit holds.
    act(() => {
      control.touch();
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.03).coordinates[1],
    );
    // The host's own fields still come through.
    expect(result.current.annotations[0]?.data).toEqual({ hostId: "l1" });
  });

  it("holds the commit while the host's store catches up out of band", async () => {
    const { control, Wrapper } = remappingHost({ defer: true });
    const { result } = renderHook(() => useAnnotate(), { wrapper: Wrapper });

    await drag(() => result.current, 0.07);

    // The host has been told, but its store has not landed. Anything that
    // re-renders it now hands us back the pre-drag geometry.
    act(() => {
      control.touch();
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.07).coordinates[1],
    );

    act(() => {
      control.flush();
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.07).coordinates[1],
    );
    expect(result.current.annotations[0]?.data).toEqual({ hostId: "l1" });
  });

  it("holds the line when the host merge drops our geometry", async () => {
    const { control, Wrapper } = remappingHost({ keepGeometry: true });
    const { result } = renderHook(() => useAnnotate(), { wrapper: Wrapper });

    await drag(() => result.current, 0.04);
    act(() => {
      control.touch();
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.04).coordinates[1],
    );

    // Two drags in a row, each still ours.
    await drag(() => result.current, 0.06);
    act(() => {
      control.touch();
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.06).coordinates[1],
    );
  });

  it("still takes a load, and host geometry once the host is in step", async () => {
    const second: Annotation = { ...line, id: "l2" };
    const { control, Wrapper } = remappingHost();
    const { result } = renderHook(() => useAnnotate(), { wrapper: Wrapper });

    await drag(() => result.current, 0.02);

    // A different id set is a load, not a stale render.
    act(() => {
      control.push([line, second]);
    });
    expect(result.current.annotations).toHaveLength(2);
    expect(result.current.canUndo).toBe(false);

    // And with the host in step, it can move geometry again.
    act(() => {
      control.push([moved(0.5), second]);
    });
    expect(endOf(result.current.annotations[0])).toEqual(
      moved(0.5).coordinates[1],
    );
  });

  it("ignores an external array that lands mid-gesture", async () => {
    const { control, Wrapper } = remappingHost();
    const { result } = renderHook(
      () => {
        const session = useAnnotate();
        return { session, painted: useLiveAnnotations(session.annotations) };
      },
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.session.beginEdit();
      result.current.session.onUpdate(moved(0.05));
    });
    await nextFrame();
    act(() => {
      control.push([{ ...line, label: "From the server" }]);
    });

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
