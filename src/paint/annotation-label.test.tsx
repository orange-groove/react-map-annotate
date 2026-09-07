import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TestMapGl } from "../test/map-gl";
import type { Annotation } from "../core/types";
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
});
