import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnnotationContextMenu } from "./annotation-context-menu";

describe("AnnotationContextMenu", () => {
  it("runs Duplicate and closes", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    render(
      <AnnotationContextMenu
        x={20}
        y={20}
        canDuplicate
        canCopy
        canPaste={false}
        canDelete
        onDuplicate={onDuplicate}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(onDuplicate).toHaveBeenCalled();
  });
});
