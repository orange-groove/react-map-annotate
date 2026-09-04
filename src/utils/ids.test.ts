import { describe, expect, it } from "vitest";
import { createAnnotationId } from "./ids";

describe("createAnnotationId", () => {
  it("returns a unique string", () => {
    const first = createAnnotationId();
    const second = createAnnotationId();
    expect(first).toEqual(expect.any(String));
    expect(first.length).toBeGreaterThan(8);
    expect(first).not.toBe(second);
  });
});
