import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnnotateProvider } from "../session/annotate-context";
import type { Annotation } from "../core/types";
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

  it("clears the label from the input", async () => {
    const onLabelChange = vi.fn();
    const user = userEvent.setup();
    render(<AnnotateList annotations={[line]} onLabelChange={onLabelChange} />);
    await user.click(
      screen.getByRole("button", { name: "Clear label for Line" }),
    );
    expect(onLabelChange).toHaveBeenCalledWith("l1", "");
  });

  it("shows an empty state", () => {
    render(<AnnotateList annotations={[]} />);
    expect(screen.getByText("No annotations")).toBeTruthy();
  });

  it("sets a font family on text annotations", () => {
    const text: Annotation = {
      id: "t1",
      kind: "text",
      label: "Hello",
      coordinate: [-73.9, 40.7],
      style: { color: "#ec4899", fontSize: 28 },
    };
    const onStyleChange = vi.fn();
    render(<AnnotateList annotations={[text]} onStyleChange={onStyleChange} />);
    fireEvent.change(screen.getByLabelText("Font for Hello"), {
      target: { value: "Georgia, serif" },
    });
    expect(onStyleChange).toHaveBeenCalledWith("t1", {
      fontFamily: "Georgia, serif",
    });
  });

  it("uses fonts injected on the provider", () => {
    const text: Annotation = {
      id: "t1",
      kind: "text",
      label: "Hello",
      coordinate: [-73.9, 40.7],
    };
    render(
      <AnnotateProvider
        initialAnnotations={[text]}
        fonts={[
          { family: "", label: "System" },
          {
            family: '"Inter"',
            label: "Inter",
            stylesheet: "https://fonts.example/inter.css",
          },
        ]}
      >
        <AnnotateList />
      </AnnotateProvider>,
    );
    expect(screen.getByRole("option", { name: "Inter" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Georgia" })).toBeNull();
    expect(
      document.querySelector('link[href="https://fonts.example/inter.css"]'),
    ).toBeTruthy();
  });

  it("sets size on arrow and bidirectional arrows", () => {
    const onStyleChange = vi.fn();
    const arrow: Annotation = {
      id: "a1",
      kind: "arrow",
      label: "North",
      coordinates: [
        [-73.9, 40.7],
        [-73.8, 40.8],
      ],
    };
    const both: Annotation = {
      id: "a2",
      kind: "bidirectional-arrow",
      label: "South",
      coordinates: [
        [-73.9, 40.7],
        [-73.8, 40.8],
      ],
      style: { strokeWidth: 4 },
    };
    render(
      <AnnotateList
        annotations={[arrow, both, line]}
        onStyleChange={onStyleChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Size for North"), {
      target: { value: "8" },
    });
    expect(onStyleChange).toHaveBeenCalledWith("a1", { strokeWidth: 8 });
    fireEvent.change(screen.getByLabelText("Size for South"), {
      target: { value: "2" },
    });
    expect(onStyleChange).toHaveBeenCalledWith("a2", { strokeWidth: 2 });
    expect(screen.queryByLabelText("Size for North fence")).toBeNull();
  });

  it("highlights the selected annotation", () => {
    const other: Annotation = {
      ...line,
      id: "l2",
      label: "South fence",
    };
    render(<AnnotateList annotations={[line, other]} selectedId="l2" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]?.getAttribute("aria-selected")).toBe("false");
    expect(items[1]?.getAttribute("aria-selected")).toBe("true");
    expect(items[1]?.className).toContain("rma-list-item--selected");
  });

  it("selects an annotation from the list", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<AnnotateList annotations={[line]} onSelect={onSelect} />);
    await user.click(screen.getByLabelText("Label for Line"));
    expect(onSelect).toHaveBeenCalledWith("l1");
  });
});
