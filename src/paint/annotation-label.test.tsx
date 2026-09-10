import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit } from "../engines/kit/types";
import { TestMapGl, testMapGl } from "../test/map-gl";
import type { Annotation, PathAnnotation } from "../core/types";
import { destination, rectangleRing } from "../core/utils/geo";
import { AnnotationLabel } from "./annotation-label";

const annotation: Annotation = {
  id: "line-1",
  kind: "line",
  label: "Route",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};

describe("AnnotationLabel", () => {
  it("renders the controlled label", () => {
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={annotation}
          longitude={0}
          latitude={0}
          selected
          editable
        />
      </TestMapGl>,
    );
    expect(screen.getByRole("button", { name: "Route" })).toBeTruthy();
  });

  it("renders nothing when the label is blank", () => {
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={{ ...annotation, label: "  " }}
          longitude={0}
          latitude={0}
          selected
          editable
        />
      </TestMapGl>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Label")).toBeNull();
  });

  it("commits an edited label through onLabelChange", async () => {
    const onLabelChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={annotation}
          longitude={0}
          latitude={0}
          selected
          editable
          onLabelChange={onLabelChange}
        />
      </TestMapGl>,
    );
    await user.dblClick(screen.getByText("Route"));
    const input = screen.getByLabelText("Annotation label");
    await user.clear(input);
    await user.type(input, "North fence");
    await user.tab();
    expect(onLabelChange).toHaveBeenCalledWith(
      "line-1",
      "North fence",
      expect.objectContaining({ id: "line-1", label: "North fence" }),
    );
  });

  it("centers the label when markerAnchor is center", () => {
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={annotation}
          longitude={0}
          latitude={0}
          selected
          editable
          markerAnchor="center"
        />
      </TestMapGl>,
    );
    expect(
      screen.getByRole("button", { name: "Route" }).closest(".rma-label")
        ?.className,
    ).toContain("rma-label--centered");
  });

  it("shows area under a shape label", () => {
    const origin: [number, number] = [0, 0];
    const rectangle: Annotation = {
      id: "rect-1",
      kind: "rectangle",
      label: "Lot",
      coordinates: rectangleRing(
        origin,
        destination(destination(origin, 90, 100), 0, 100),
      ),
    };
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={rectangle}
          longitude={0}
          latitude={0}
          selected
          editable
        />
      </TestMapGl>,
    );
    expect(screen.getByRole("button", { name: "Lot" })).toBeTruthy();
    const area = screen.getByText(/m²$/);
    expect(Number(area.textContent?.replace(" m²", ""))).toBeCloseTo(
      10_000,
      -2,
    );
  });

  it("hides the name when showLabel is false", () => {
    const origin: [number, number] = [0, 0];
    const rectangle: Annotation = {
      id: "rect-1",
      kind: "rectangle",
      label: "Lot",
      coordinates: rectangleRing(
        origin,
        destination(destination(origin, 90, 100), 0, 100),
      ),
    };
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={rectangle}
          longitude={0}
          latitude={0}
          selected
          editable
          showLabel={false}
        />
      </TestMapGl>,
    );
    expect(screen.queryByRole("button", { name: "Lot" })).toBeNull();
    expect(screen.getByText(/m²$/)).toBeTruthy();
  });

  it("hides the area when showArea is false", () => {
    const origin: [number, number] = [0, 0];
    const rectangle: Annotation = {
      id: "rect-1",
      kind: "rectangle",
      label: "Lot",
      coordinates: rectangleRing(
        origin,
        destination(destination(origin, 90, 100), 0, 100),
      ),
    };
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={rectangle}
          longitude={0}
          latitude={0}
          selected
          editable
          showArea={false}
        />
      </TestMapGl>,
    );
    expect(screen.getByRole("button", { name: "Lot" })).toBeTruthy();
    expect(screen.queryByText(/m²$/)).toBeNull();
  });

  it("renders a custom label", () => {
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={annotation}
          longitude={0}
          latitude={0}
          selected
          editable
          render={({ annotation, selected }) => (
            <span data-selected={selected ? "yes" : "no"}>
              custom:{annotation.label}
            </span>
          )}
        />
      </TestMapGl>,
    );
    expect(screen.getByText("custom:Route")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Route" })).toBeNull();
  });

  it("shift-clicks the label once instead of toggling twice", () => {
    const onSelect = vi.fn();
    render(
      <TestMapGl>
        <AnnotationLabel
          annotation={annotation}
          longitude={0}
          latitude={0}
          selected={false}
          editable
          onSelect={onSelect}
        />
      </TestMapGl>,
    );
    const label = screen.getByRole("button", { name: "Route" });
    fireEvent.pointerDown(label, { shiftKey: true });
    fireEvent.click(label, { shiftKey: true });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("line-1", { additive: true });
  });
});

const other: Annotation = {
  id: "line-2",
  kind: "line",
  label: "Path",
  coordinates: [
    [4, 4],
    [5, 5],
  ],
};

/** A kit with a real map behind it, so the label can drag. */
function draggableMapGl() {
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
    ...testMapGl,
    useMap: () => ({ current: { getMap: () => map } }),
  } as unknown as GlKit;
}

function endOf(item: Annotation) {
  return (item as PathAnnotation).coordinates[1];
}

describe("dragging an annotation by its label", () => {
  function renderDraggable(
    props: Partial<React.ComponentProps<typeof AnnotationLabel>> = {},
  ) {
    const onUpdate = vi.fn();
    const onUpdateMany = vi.fn();
    const onSelect = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <MapGlProvider value={draggableMapGl()}>
        <AnnotationLabel
          annotation={annotation}
          longitude={0.5}
          latitude={0.5}
          selected={false}
          editable
          onSelect={onSelect}
          onUpdate={onUpdate}
          onUpdateMany={onUpdateMany}
          onDragEnd={onDragEnd}
          {...props}
        />
      </MapGlProvider>,
    );
    return {
      label: document.querySelector("[data-rma-label]")!,
      onUpdate,
      onUpdateMany,
      onSelect,
      onDragEnd,
    };
  }

  it("moves the annotation with the pointer", () => {
    const { label, onUpdate, onDragEnd } = renderDraggable();

    fireEvent.pointerDown(label, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 20, pointerId: 1 });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const moved = onUpdate.mock.calls[0]?.[0] as Annotation;
    expect(moved.id).toBe("line-1");
    expect(endOf(moved)).toEqual([1.5, 1.2]);

    fireEvent.pointerUp(window, { clientX: 50, clientY: 20, pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledWith("line-1");
  });

  it("selects on pointer-down without moving anything", () => {
    const { label, onSelect, onUpdate, onDragEnd } = renderDraggable();

    fireEvent.pointerDown(label, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith("line-1");
    expect(onUpdate).not.toHaveBeenCalled();

    // A click wanders a pixel. That is not a drag.
    fireEvent.pointerMove(window, { clientX: 1, clientY: 1, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 1, clientY: 1, pointerId: 1 });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it("still renames on double-click", () => {
    const { label } = renderDraggable();

    fireEvent.pointerDown(label, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.doubleClick(label);

    expect(screen.getByLabelText("Annotation label")).toBeTruthy();
  });

  it("does not drag while the label is being renamed", () => {
    const { label, onUpdate } = renderDraggable();

    fireEvent.doubleClick(label);
    const input = screen.getByLabelText("Annotation label");
    fireEvent.pointerDown(input, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 0, pointerId: 1 });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("takes the rest of the selection along", () => {
    const { label, onUpdate, onUpdateMany } = renderDraggable({
      annotations: [annotation, other],
      selectedIds: ["line-1", "line-2"],
    });

    fireEvent.pointerDown(label, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 0, pointerId: 1 });

    expect(onUpdate).not.toHaveBeenCalled();
    const moved = onUpdateMany.mock.calls[0]?.[0] as Annotation[];
    expect(moved.map((item) => item.id)).toEqual(["line-1", "line-2"]);
    expect(endOf(moved[0]!)).toEqual([1.5, 1]);
    expect(endOf(moved[1]!)).toEqual([5.5, 5]);
  });

  it("drags a custom rendered label too", () => {
    const { label, onUpdate } = renderDraggable({
      render: () => <span>Custom</span>,
    });

    fireEvent.pointerDown(label, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 0, pointerId: 1 });

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
