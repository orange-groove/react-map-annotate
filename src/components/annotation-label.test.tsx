import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Annotation } from "../types";
import { AnnotationLabel } from "./annotation-label";

vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children?: ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

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
      <AnnotationLabel
        annotation={annotation}
        longitude={0}
        latitude={0}
        selected
        editable
      />,
    );
    expect(screen.getByRole("button", { name: "Route" })).toBeTruthy();
  });

  it("commits an edited label through onLabelChange", async () => {
    const onLabelChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotationLabel
        annotation={annotation}
        longitude={0}
        latitude={0}
        selected
        editable
        onLabelChange={onLabelChange}
      />,
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
});
