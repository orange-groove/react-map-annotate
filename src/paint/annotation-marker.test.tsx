import type { ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit, MarkerClickEvent } from "../engines/kit/types";
import type { MarkerAnnotation } from "../core/types";
import { AnnotationMarker } from "./annotation-marker";

const pin: MarkerAnnotation = {
  id: "pin-1",
  kind: "marker",
  label: "Pin",
  coordinate: [0, 0],
};

function createKit(getMap?: () => unknown) {
  const dragPan = {
    enabled: true,
    enable: vi.fn(() => {
      dragPan.enabled = true;
    }),
    disable: vi.fn(() => {
      dragPan.enabled = false;
    }),
    isEnabled: vi.fn(() => dragPan.enabled),
  };
  const map = {
    dragPan,
    getCanvas: () =>
      ({
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      }) as HTMLElement,
    unproject: ([x, y]: [number, number]) => ({
      lng: x / 100,
      lat: y / 100,
    }),
  };
  const kit = {
    engine: "mapbox",
    Source: () => null,
    Layer: () => null,
    Marker: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: (event: MarkerClickEvent) => void;
    }) => (
      <div
        data-testid="marker"
        onClick={(event) => onClick?.({ originalEvent: event.nativeEvent })}
      >
        {children}
      </div>
    ),
    useMap: () => ({ current: { getMap: getMap ?? (() => map) } }),
  } as unknown as GlKit;
  return { kit, map, dragPan };
}

describe("AnnotationMarker", () => {
  it("moves the pin while dragging", () => {
    const { kit, dragPan } = createKit();
    const onUpdate = vi.fn();
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationMarker
          annotation={pin}
          selected={false}
          color="#2563eb"
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDragEnd={onDragEnd}
        />
      </MapGlProvider>,
    );

    const hit = document.querySelector(".rma-marker-hit");
    expect(hit).toBeTruthy();
    fireEvent.pointerDown(hit!, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith("pin-1");
    expect(dragPan.disable).toHaveBeenCalled();

    fireEvent.pointerMove(window, { clientX: 50, clientY: -20, pointerId: 1 });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pin-1",
        coordinate: [0.5, -0.2],
      }),
    );

    fireEvent.pointerUp(window, { clientX: 50, clientY: -20, pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledWith("pin-1");
    expect(dragPan.enable).toHaveBeenCalled();
  });

  it("selects from the pin body on pointerdown even if the map is missing", () => {
    const { kit } = createKit(() => null);
    const onSelect = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationMarker
          annotation={pin}
          selected={false}
          color="#2563eb"
          onSelect={onSelect}
        />
      </MapGlProvider>,
    );

    fireEvent.pointerDown(document.querySelector(".rma-marker-hit")!, {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    expect(onSelect).toHaveBeenCalledWith("pin-1");
  });

  it("selects from a map engine click when pointerdown never ran", () => {
    const { kit } = createKit();
    const onSelect = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationMarker
          annotation={pin}
          selected={false}
          color="#2563eb"
          onSelect={onSelect}
        />
      </MapGlProvider>,
    );

    fireEvent.click(document.querySelector("[data-testid=marker]")!);
    expect(onSelect).toHaveBeenCalledWith("pin-1");
  });

  it("does not toggle off when pointerdown is followed by click", () => {
    const { kit } = createKit();
    const onSelect = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationMarker
          annotation={pin}
          selected={false}
          color="#2563eb"
          selectedIds={[]}
          onSelect={onSelect}
        />
      </MapGlProvider>,
    );

    const hit = document.querySelector(".rma-marker-hit")!;
    fireEvent.pointerDown(hit, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.click(hit);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("additive-selects the pin without starting a drag", () => {
    const { kit, dragPan } = createKit();
    const onSelect = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationMarker
          annotation={pin}
          selected={false}
          color="#2563eb"
          onSelect={onSelect}
        />
      </MapGlProvider>,
    );

    fireEvent.pointerDown(document.querySelector(".rma-marker-hit")!, {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      shiftKey: true,
    });
    expect(onSelect).toHaveBeenCalledWith("pin-1", { additive: true });
    expect(dragPan.disable).not.toHaveBeenCalled();
  });
});
