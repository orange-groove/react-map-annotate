import { describe, expect, it } from "vitest";
import type { MapLike } from "../engines/kit/types";
import { marqueeHost } from "./marquee";

function fakeMap(canvas: HTMLElement, overlay?: HTMLElement | null): MapLike {
  return {
    getCanvas: () => canvas,
    getOverlayHost: overlay === undefined ? undefined : () => overlay,
  } as MapLike;
}

describe("marqueeHost", () => {
  it("uses Google's viewport pane instead of the world overlay", () => {
    const div = document.createElement("div");
    const gm = document.createElement("div");
    gm.className = "gm-style";
    const overlay = document.createElement("div");
    overlay.className = "rma-google-overlay";
    gm.append(overlay);
    div.append(gm);
    expect(marqueeHost(fakeMap(div, overlay))).toBe(gm);
  });

  it("keeps Mapbox and ArcGIS hosts on the overlay or canvas parent", () => {
    const canvas = document.createElement("canvas");
    const parent = document.createElement("div");
    parent.append(canvas);
    expect(marqueeHost(fakeMap(canvas))).toBe(parent);

    const container = document.createElement("div");
    const overlay = document.createElement("div");
    overlay.className = "rma-arcgis-overlay";
    container.append(overlay);
    expect(marqueeHost(fakeMap(container, overlay))).toBe(overlay);
  });
});
