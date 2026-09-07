import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DefaultArrowHead } from "./arrow-head";

describe("DefaultArrowHead", () => {
  it("rotates the custom svg by the geodesic bearing", () => {
    const { container } = render(
      <DefaultArrowHead
        direction="end"
        bearing={137}
        color="#2563eb"
        selected={false}
        size={26}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("style")).toContain("rotate(137deg)");
    expect(svg?.getAttribute("width")).toBe("26");
    expect(container.querySelector("path")?.getAttribute("fill")).toBe(
      "#2563eb",
    );
  });
});
