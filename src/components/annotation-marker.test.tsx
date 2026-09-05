import type { ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../gl/context";
import type { GlKit } from "../gl/types";
import type { MarkerAnnotation } from "../types";
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
    Marker: ({ children }: { children?: ReactNode }) => (
      <div data-testid="marker">{children}</div>
    ),
    useMap: () => ({ current: { getMap: () => map } }),
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

    const hit = document.querySelector(".rmga-marker-hit");
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
});
