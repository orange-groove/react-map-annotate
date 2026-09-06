import { describe, expect, it } from "vitest";
import { googleMarkerAnchor } from "./marker";

describe("googleMarkerAnchor", () => {
  it("uses CSS translations so the named point sits on the lat/lng", () => {
    expect(googleMarkerAnchor("center")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-50%",
    });
    expect(googleMarkerAnchor("bottom")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-100%",
    });
    expect(googleMarkerAnchor(undefined, true)).toEqual({
      anchorLeft: "-50%",
      anchorTop: "-100%",
    });
    expect(googleMarkerAnchor("top")).toEqual({
      anchorLeft: "-50%",
      anchorTop: "0%",
    });
    expect(googleMarkerAnchor("left")).toEqual({
      anchorLeft: "0%",
      anchorTop: "-50%",
    });
    expect(googleMarkerAnchor("right")).toEqual({
      anchorLeft: "-100%",
      anchorTop: "-50%",
    });
  });
});
