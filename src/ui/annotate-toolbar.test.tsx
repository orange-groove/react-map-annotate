import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TOOLBAR_TOOLS } from "../core/constants";
import { AnnotateToolbar } from "./annotate-toolbar";

describe("AnnotateToolbar", () => {
  it("renders every default tool", () => {
    render(<AnnotateToolbar tool="select" onToolChange={() => undefined} />);
    expect(
      screen.getByRole("toolbar", { name: "Map annotation tools" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
    expect(screen.getByRole("button", { name: "Freehand" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Line" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Arrow" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Bidirectional Arrow" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Circle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Polygon" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Measure" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marker" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish drawing" })).toBeTruthy();
    expect(DEFAULT_TOOLBAR_TOOLS).toHaveLength(11);
  });

  it("notifies the host when a tool is chosen", async () => {
    const onToolChange = vi.fn();
    const user = userEvent.setup();
    render(<AnnotateToolbar tool="select" onToolChange={onToolChange} />);
    await user.click(screen.getByRole("button", { name: "Measure" }));
    expect(onToolChange).toHaveBeenCalledWith("measure");
  });

  it("deletes the selected annotation", async () => {
    const onDeleteSelected = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotateToolbar
        tool="select"
        selectedId="a"
        onToolChange={() => undefined}
        onDeleteSelected={onDeleteSelected}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Delete selected annotation" }),
    );
    expect(onDeleteSelected).toHaveBeenCalled();
  });

  it("undoes from the toolbar", async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotateToolbar
        tool="select"
        onToolChange={() => undefined}
        onUndo={onUndo}
        canUndo
      />,
    );
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("finishes the current drawing", async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotateToolbar
        tool="polygon"
        onToolChange={() => undefined}
        onFinish={onFinish}
        canFinish
      />,
    );
    await user.click(screen.getByRole("button", { name: "Finish drawing" }));
    expect(onFinish).toHaveBeenCalled();
  });
});
