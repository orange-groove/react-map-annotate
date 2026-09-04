import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "../context/annotate-context";
import type { Annotation } from "../types";
import { AnnotateList } from "./annotate-list";

const line: Annotation = {
  id: "l1",
  kind: "line",
  label: "North fence",
  coordinates: [
    [-73.9, 40.7],
    [-73.8, 40.8],
  ],
  style: { color: "#2563eb" },
};

function inputValue(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

describe("AnnotateList", () => {
  it("lists annotations from the session", () => {
    render(
      <AnnotateProvider initialAnnotations={[line]}>
        <AnnotateList />
      </AnnotateProvider>,
    );
    expect(screen.getByRole("list", { name: "Annotations" })).toBeTruthy();
    expect(inputValue("Label for Line")).toBe("North fence");
    expect(inputValue("Color for North fence")).toBe("#2563eb");
  });

  it("changes a label and color from the list", async () => {
    const user = userEvent.setup();
    render(
      <AnnotateProvider initialAnnotations={[line]}>
        <AnnotateList />
      </AnnotateProvider>,
    );
    const label = screen.getByLabelText("Label for Line");
    await user.clear(label);
    await user.type(label, "South fence");
    expect(inputValue("Label for Line")).toBe("South fence");

    fireEvent.change(screen.getByLabelText("Color for South fence"), {
      target: { value: "#ef4444" },
    });
    expect(inputValue("Color for South fence")).toBe("#ef4444");
  });

  it("uses host callbacks when provided", async () => {
    const onLabelChange = vi.fn();
    const onColorChange = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotateList
        annotations={[line]}
        onLabelChange={onLabelChange}
        onColorChange={onColorChange}
        onDelete={onDelete}
      />,
    );
    await user.type(screen.getByLabelText("Label for Line"), "!");
    expect(onLabelChange).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Color for North fence"), {
      target: { value: "#22c55e" },
    });
    expect(onColorChange).toHaveBeenCalledWith("l1", "#22c55e");
    await user.click(
      screen.getByRole("button", { name: "Delete North fence" }),
    );
    expect(onDelete).toHaveBeenCalledWith("l1");
  });

  it("shows an empty state", () => {
    render(<AnnotateList annotations={[]} />);
    expect(screen.getByText("No annotations")).toBeTruthy();
  });
});
