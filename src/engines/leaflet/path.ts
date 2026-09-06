import type { LngLat } from "../../core/types";

export function toLatLngs(coordinates: LngLat[]): [number, number][] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

export function leafletMarkerShift(
  width: number,
  height: number,
  anchor?: string,
  pin = false,
  offset: [number, number] = [0, 0],
): { x: number; y: number } {
  let x = -width / 2;
  let y = -height / 2;
  if (pin || anchor === "bottom") {
    y = -height;
  } else if (anchor === "top") {
    y = 0;
  } else if (anchor === "left") {
    x = 0;
  } else if (anchor === "right") {
    x = -width;
  }
  return { x: x + offset[0], y: y + offset[1] };
}
