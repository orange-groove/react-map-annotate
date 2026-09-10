import * as React from "react";
import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit, MapLike, MapPointerEvent } from "../engines/kit/types";
import type { AnnotateTool, Annotation, DrawMode } from "../core/types";
import { AnnotateProvider } from "../session/annotate-context";
import { useAnnotate } from "../session/use-annotate";
import { Annotate } from "./annotate";

/** 0.01° of longitude at the equator is roughly 1.1 km, well clear of the 1 m floor. */
const SCALE = 1000;

function createKit() {
  const listeners = new Map<string, Array<(event: MapPointerEvent) => void>>();
  const canvas = document.createElement("div");
  const map = {
    isStyleLoaded: () => true,
    getCanvas: () => canvas,
    getLayer: () => null,
    getSource: () => null,
    getTerrain: () => null,
    setTerrain: () => undefined,
    queryRenderedFeatures: () => [],
    project: ({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng * SCALE,
      y: -lat * SCALE,
    }),
    unproject: ([x, y]: [number, number]) => ({
      lng: x / SCALE,
      lat: -y / SCALE,
    }),
    dragPan: {
      enable: () => undefined,
      disable: () => undefined,
      isEnabled: () => true,
    },
    on: (type: string, listener: (event: MapPointerEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    off: (type: string, listener: (event: MapPointerEvent) => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((item) => item !== listener),
      );
    },
  } as unknown as MapLike;

  const kit = {
    engine: "mapbox",
    Source: () => null,
    Layer: () => null,
    Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    useMap: () => ({ current: { getMap: () => map } }),
  } as unknown as GlKit;

  function emit(type: string, lng: number, lat: number) {
    const event = {
      originalEvent: new MouseEvent(type, { button: 0 }),
      point: { x: lng * SCALE, y: -lat * SCALE },
      lngLat: { lng, lat },
      preventDefault: () => undefined,
      target: map,
    } as unknown as MapPointerEvent;
    act(() => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    });
  }

  return { kit, emit };
}

function renderMap(drawMode: DrawMode) {
  const { kit, emit } = createKit();
  const seen: { annotations: Annotation[] } = { annotations: [] };

  function Harness({ tool }: { tool: AnnotateTool }) {
    const session = useAnnotate();
    seen.annotations = session.annotations;
    const { setTool } = session;
    React.useEffect(() => setTool(tool), [setTool, tool]);
    return null;
  }

  function Mount({ tool }: { tool: AnnotateTool }) {
    return (
      <MapGlProvider value={kit}>
        <AnnotateProvider drawMode={drawMode}>
          <Harness tool={tool} />
          <Annotate />
        </AnnotateProvider>
      </MapGlProvider>
    );
  }

  return { emit, seen, Mount };
}

function readout(view: { container: HTMLElement }): string | null {
  return (
    view.container.querySelector(".rma-draft-measure")?.textContent ?? null
  );
}

function drag(
  emit: (type: string, lng: number, lat: number) => void,
  from: [number, number],
  to: [number, number],
) {
  emit("mousedown", from[0], from[1]);
  emit("mousemove", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  emit("mousemove", to[0], to[1]);
  emit("mouseup", to[0], to[1]);
}

describe("drawMode", () => {
  it("draws a rectangle from two clicks by default", () => {
    const { emit, seen, Mount } = renderMap("click");
    render(<Mount tool="rectangle" />);

    emit("click", 0, 0);
    expect(seen.annotations).toHaveLength(0);

    emit("mousemove", 0.01, 0.01);
    emit("click", 0.02, 0.02);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("rectangle");
  });

  it("ignores a press-drag-release in click mode", () => {
    const { emit, seen, Mount } = renderMap("click");
    render(<Mount tool="circle" />);

    drag(emit, [0, 0], [0.02, 0.02]);

    expect(seen.annotations).toHaveLength(0);
  });

  it("draws a circle from one press-drag-release in drag mode", () => {
    const { emit, seen, Mount } = renderMap("drag");
    render(<Mount tool="circle" />);

    drag(emit, [0, 0], [0.02, 0]);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("circle");
  });

  it("draws a measure from one press-drag-release in drag mode", () => {
    const { emit, seen, Mount } = renderMap("drag");
    render(<Mount tool="measure" />);

    drag(emit, [0, 0], [0.02, 0]);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("measure");
  });

  it("ignores a click that never moved in drag mode", () => {
    const { emit, seen, Mount } = renderMap("drag");
    render(<Mount tool="rectangle" />);

    emit("mousedown", 0, 0);
    emit("mouseup", 0, 0);
    emit("click", 0, 0);

    expect(seen.annotations).toHaveLength(0);
  });

  it("leaves the two-click tools alone in click mode", () => {
    const { emit, seen, Mount } = renderMap("click");
    render(<Mount tool="line" />);

    emit("click", 0, 0);
    emit("click", 0.02, 0);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("line");
  });

  it("draws a line from one press-drag-release in drag mode", () => {
    const { emit, seen, Mount } = renderMap("drag");
    render(<Mount tool="line" />);

    drag(emit, [0, 0], [0.02, 0]);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("line");
  });

  it("leaves polygon and freehand alone in either mode", () => {
    const { emit, seen, Mount } = renderMap("drag");
    render(<Mount tool="polygon" />);

    emit("click", 0, 0);
    emit("click", 0.02, 0);
    emit("click", 0.02, 0.02);
    emit("dblclick", 0.02, 0.02);

    expect(seen.annotations).toHaveLength(1);
    expect(seen.annotations[0].kind).toBe("polygon");
  });
});

describe("the measure readout while drawing", () => {
  it("follows the cursor after the first click", () => {
    const { emit, Mount } = renderMap("click");
    const view = render(<Mount tool="measure" />);

    emit("click", 0, 0);
    // One point is not a distance yet.
    expect(readout(view)).toBeNull();

    emit("mousemove", 0.01, 0);
    const first = readout(view);
    expect(first).toBe("1.11 km");

    emit("mousemove", 0.05, 0);
    expect(readout(view)).toBe("5.56 km");
  });

  it("follows the pointer through a drag, then hands off to the caption", () => {
    const { emit, seen, Mount } = renderMap("drag");
    const view = render(<Mount tool="measure" />);

    emit("mousedown", 0, 0);
    emit("mousemove", 0.02, 0);
    expect(readout(view)).toBe("2.22 km");

    // The committed caption reads the same as the live number it replaces.
    emit("mouseup", 0.02, 0);
    expect(readout(view)).toBeNull();
    expect(seen.annotations[0].caption).toBe("2.22 km");
  });

  it("stays off for shapes that are not measures", () => {
    const { emit, Mount } = renderMap("click");
    const view = render(<Mount tool="rectangle" />);

    emit("click", 0, 0);
    emit("mousemove", 0.02, 0.02);

    expect(readout(view)).toBeNull();
  });
});
