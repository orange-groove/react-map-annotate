import type { ReactNode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit } from "../engines/kit/types";
import type { Annotation, MarkerAnnotation } from "../core/types";
import { AnnotateProvider } from "../session/annotate-context";
import { useAnnotate } from "../session/use-annotate";
import { useLiveAnnotations } from "../session/live-edits";
import { AnnotationMarker } from "./annotation-marker";

const pin: MarkerAnnotation = {
  id: "pin-1",
  kind: "marker",
  label: "Pin",
  coordinate: [0, 0],
};

function createKit() {
  const dragPan = {
    enabled: true,
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: () => dragPan.enabled,
  };
  const map = {
    dragPan,
    getCanvas: () =>
      ({
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      }) as HTMLElement,
    unproject: ([x, y]: [number, number]) => ({ lng: x / 100, lat: y / 100 }),
  };
  return {
    engine: "mapbox",
    Source: () => null,
    Layer: () => null,
    Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    useMap: () => ({ current: { getMap: () => map } }),
  } as unknown as GlKit;
}

function coordinateOf(annotation: Annotation | undefined) {
  return (annotation as MarkerAnnotation | undefined)?.coordinate;
}

/**
 * Drives a marker drag through the real session, the way the map does.
 */
function renderDrag(onChange: () => void, onCommit: () => void) {
  const seen: {
    session: Annotation[];
    painted: Annotation[];
    undo: () => void;
    renders: number;
  } = { session: [], painted: [], undo: () => undefined, renders: 0 };

  function Harness() {
    const session = useAnnotate();
    const painted = useLiveAnnotations(session.annotations);
    seen.session = session.annotations;
    seen.painted = painted;
    seen.undo = session.undo;
    seen.renders += 1;
    const marker = painted[0] as MarkerAnnotation;
    return (
      <AnnotationMarker
        annotation={marker}
        selected={false}
        color="#2563eb"
        annotations={painted}
        onSelect={session.onSelect}
        onUpdate={session.onUpdate}
        onDragEnd={() => session.endEdit()}
      />
    );
  }

  render(
    <MapGlProvider value={createKit()}>
      <AnnotateProvider
        initialAnnotations={[pin]}
        onChange={onChange}
        onCommit={onCommit}
      >
        <Harness />
      </AnnotateProvider>
    </MapGlProvider>,
  );
  return seen;
}

describe("dragging an annotation", () => {
  it("follows the pointer without committing anything", async () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const seen = renderDrag(onChange, onCommit);

    const hit = document.querySelector(".rma-marker-hit")!;
    fireEvent.pointerDown(hit, { clientX: 0, clientY: 0, pointerId: 1 });
    const rendersAtDragStart = seen.renders;
    for (const x of [10, 20, 30, 40, 50]) {
      fireEvent.pointerMove(window, { clientX: x, clientY: 0, pointerId: 1 });
    }
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(coordinateOf(seen.session[0])).toEqual([0, 0]);
    // The map still shows the pointer position.
    expect(coordinateOf(seen.painted[0])).toEqual([0.5, 0]);
    // Five moves, one frame, one paint.
    expect(seen.renders - rendersAtDragStart).toBe(1);
  });

  it("commits once on pointer-up with the final position", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const seen = renderDrag(onChange, onCommit);

    const hit = document.querySelector(".rma-marker-hit")!;
    fireEvent.pointerDown(hit, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 25, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: -20, pointerId: 1 });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(coordinateOf(seen.session[0])).toEqual([0.5, -0.2]);
    expect(coordinateOf(seen.painted[0])).toEqual([0.5, -0.2]);
  });

  it("undoes the whole drag in one step", () => {
    const seen = renderDrag(vi.fn(), vi.fn());

    const hit = document.querySelector(".rma-marker-hit")!;
    fireEvent.pointerDown(hit, { clientX: 0, clientY: 0, pointerId: 1 });
    for (const x of [10, 20, 30]) {
      fireEvent.pointerMove(window, { clientX: x, clientY: 0, pointerId: 1 });
    }
    fireEvent.pointerUp(window, { clientX: 30, clientY: 0, pointerId: 1 });
    expect(coordinateOf(seen.session[0])).toEqual([0.3, 0]);

    act(() => seen.undo());
    expect(coordinateOf(seen.session[0])).toEqual([0, 0]);
  });
});
