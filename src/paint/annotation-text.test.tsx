import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit } from "../engines/kit/types";
import type { TextAnnotation } from "../core/types";
import { AnnotationText } from "./annotation-text";

const note: TextAnnotation = {
  id: "text-1",
  kind: "text",
  label: "Hello",
  coordinate: [0, 0],
  style: { color: "#ef4444", fontSize: 28, fontFamily: "Georgia, serif" },
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
  return { kit, dragPan };
}

describe("AnnotationText", () => {
  it("renders colored text at the stored size", () => {
    const { kit } = createKit();
    render(
      <MapGlProvider value={kit}>
        <AnnotationText
          annotation={note}
          selected={false}
          active={false}
          color="#2563eb"
          editable
        />
      </MapGlProvider>,
    );
    const label = screen.getByText("Hello");
    expect(label.parentElement?.style.color).toBe("rgb(239, 68, 68)");
    expect(label.parentElement?.style.fontSize).toBe("28px");
    expect(label.parentElement?.style.fontFamily).toBe("Georgia, serif");
  });

  it("rotates the label from the stored angle", () => {
    const { kit } = createKit();
    render(
      <MapGlProvider value={kit}>
        <AnnotationText
          annotation={{ ...note, rotation: 25 }}
          selected={false}
          active={false}
          color="#2563eb"
          editable
        />
      </MapGlProvider>,
    );
    expect(screen.getByText("Hello").parentElement?.style.transform).toBe(
      "rotate(25deg)",
    );
  });

  it("moves the text while dragging", () => {
    const { kit, dragPan } = createKit();
    const onUpdate = vi.fn();
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationText
          annotation={note}
          selected
          active
          color="#2563eb"
          editable
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDragEnd={onDragEnd}
        />
      </MapGlProvider>,
    );

    const hit = document.querySelector(".rma-text");
    fireEvent.pointerDown(hit!, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith("text-1");
    expect(dragPan.disable).toHaveBeenCalled();
    fireEvent.pointerMove(window, { clientX: 50, clientY: -20, pointerId: 1 });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "text-1",
        coordinate: [0.5, -0.2],
      }),
    );
    fireEvent.pointerUp(window, { clientX: 50, clientY: -20, pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledWith("text-1");
  });

  it("resizes font size from the corner handle", () => {
    const { kit } = createKit();
    const onUpdate = vi.fn();
    render(
      <MapGlProvider value={kit}>
        <AnnotationText
          annotation={note}
          selected
          active
          color="#2563eb"
          editable
          onUpdate={onUpdate}
        />
      </MapGlProvider>,
    );

    const handle = screen.getByRole("button", { name: "Resize text" });
    fireEvent.pointerDown(handle, { clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40, pointerId: 2 });
    expect(onUpdate).toHaveBeenCalled();
    const calls = onUpdate.mock.calls as Array<[TextAnnotation]>;
    const next = calls[calls.length - 1]?.[0];
    expect(next?.style?.fontSize).toBeGreaterThan(28);
  });

  it("commits an edited label", async () => {
    const onLabelChange = vi.fn();
    const user = userEvent.setup();
    const { kit } = createKit();
    render(
      <MapGlProvider value={kit}>
        <AnnotationText
          annotation={note}
          selected={false}
          active={false}
          color="#2563eb"
          editable
          onLabelChange={onLabelChange}
        />
      </MapGlProvider>,
    );
    await user.dblClick(screen.getByText("Hello"));
    const input = screen.getByLabelText("Text annotation");
    expect(document.querySelector(".rma-text-sizer")?.textContent).toBe(
      "Hello",
    );
    expect(input.parentElement).toBe(document.querySelector(".rma-text"));
    await user.clear(input);
    await user.type(input, "North gate");
    await user.tab();
    expect(onLabelChange).toHaveBeenCalledWith(
      "text-1",
      "North gate",
      expect.objectContaining({ id: "text-1", label: "North gate" }),
    );
  });
});
