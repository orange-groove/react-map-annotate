import { EARTH_RADIUS_M } from "../constants";
import type { LngLat } from "../types";

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

export function haversineDistance(a: LngLat, b: LngLat): number {
  const lat1 = a[1] * TO_RAD;
  const lat2 = b[1] * TO_RAD;
  const dLat = (b[1] - a[1]) * TO_RAD;
  const dLng = (b[0] - a[0]) * TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initialBearing(from: LngLat, to: LngLat): number {
  const lat1 = from[1] * TO_RAD;
  const lat2 = to[1] * TO_RAD;
  const dLng = (to[0] - from[0]) * TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * TO_DEG + 360) % 360;
}

export function destination(
  start: LngLat,
  bearingDeg: number,
  distanceM: number,
): LngLat {
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = bearingDeg * TO_RAD;
  const lat1 = start[1] * TO_RAD;
  const lng1 = start[0] * TO_RAD;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angular);
  const cosAngular = Math.cos(angular);
  const lat2 = Math.asin(
    sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * sinAngular * cosLat1,
      cosAngular - sinLat1 * Math.sin(lat2),
    );
  return [((lng2 * TO_DEG + 540) % 360) - 180, lat2 * TO_DEG];
}

export function interpolateGeodesic(
  a: LngLat,
  b: LngLat,
  fraction: number,
): LngLat {
  const distance = haversineDistance(a, b);
  if (distance === 0 || fraction <= 0) return a;
  if (fraction >= 1) return b;
  return destination(a, initialBearing(a, b), distance * fraction);
}

export function pathLength(coordinates: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

export function densifyPath(
  coordinates: LngLat[],
  intervalMeters = 10,
): LngLat[] {
  if (coordinates.length < 2) return coordinates.slice();
  const out: LngLat[] = [coordinates[0]];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    const distance = haversineDistance(a, b);
    const bearing = initialBearing(a, b);
    const steps = Math.floor(distance / intervalMeters);
    for (let step = 1; step <= steps; step++) {
      const along = step * intervalMeters;
      if (along < distance - 1e-6) {
        out.push(destination(a, bearing, along));
      }
    }
    out.push(b);
  }
  return out;
}

export function circleRing(
  center: LngLat,
  radiusMeters: number,
  steps = 64,
): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i < steps; i++) {
    ring.push(destination(center, (360 * i) / steps, radiusMeters));
  }
  ring.push(ring[0]);
  return ring;
}

export function rectangleRing(a: LngLat, b: LngLat): LngLat[] {
  const west = Math.min(a[0], b[0]);
  const east = Math.max(a[0], b[0]);
  const south = Math.min(a[1], b[1]);
  const north = Math.max(a[1], b[1]);
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

export function sameLngLat(a: LngLat, b: LngLat): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function closeRing(coordinates: LngLat[]): LngLat[] {
  if (coordinates.length === 0) return [];
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (sameLngLat(first, last)) {
    return coordinates.slice();
  }
  return [...coordinates, first];
}

export function openRing(coordinates: LngLat[]): LngLat[] {
  if (
    coordinates.length > 1 &&
    sameLngLat(coordinates[0], coordinates[coordinates.length - 1])
  ) {
    return coordinates.slice(0, -1);
  }
  return coordinates.slice();
}

export function coordinateBounds(coordinates: LngLat[]): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  if (coordinates.length === 0) return null;
  let west = coordinates[0][0];
  let east = coordinates[0][0];
  let south = coordinates[0][1];
  let north = coordinates[0][1];
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

export function boundsRing(coordinates: LngLat[]): LngLat[] {
  const bounds = coordinateBounds(coordinates);
  if (!bounds) return [];
  return rectangleRing(
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  );
}

export function ringCentroid(coordinates: LngLat[]): LngLat {
  const pts =
    coordinates.length > 1 &&
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1]
      ? coordinates.slice(0, -1)
      : coordinates;
  if (pts.length === 0) return [0, 0];
  let lng = 0;
  let lat = 0;
  for (const point of pts) {
    lng += point[0];
    lat += point[1];
  }
  return [lng / pts.length, lat / pts.length];
}

export function pathMidpoint(coordinates: LngLat[]): LngLat {
  if (coordinates.length === 0) return [0, 0];
  if (coordinates.length === 1) return coordinates[0];
  const total = pathLength(coordinates);
  if (total === 0) return coordinates[0];
  const target = total / 2;
  let walked = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const segment = haversineDistance(coordinates[i], coordinates[i + 1]);
    if (walked + segment >= target) {
      return interpolateGeodesic(
        coordinates[i],
        coordinates[i + 1],
        segment === 0 ? 0 : (target - walked) / segment,
      );
    }
    walked += segment;
  }
  return coordinates[coordinates.length - 1];
}

export function ringArea(coordinates: LngLat[]): number {
  const pts = openRing(coordinates);
  if (pts.length < 3) return 0;
  let total = 0;
  for (let index = 0; index < pts.length; index += 1) {
    const a = pts[index];
    const b = pts[(index + 1) % pts.length];
    total +=
      (b[0] - a[0]) *
      TO_RAD *
      (2 + Math.sin(a[1] * TO_RAD) + Math.sin(b[1] * TO_RAD));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "0 m";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters >= 10) return `${Math.round(meters)} m`;
  return `${meters.toFixed(1)} m`;
}

export function formatArea(squareMeters: number): string {
  if (!Number.isFinite(squareMeters)) return "0 m²";
  if (squareMeters >= 1_000_000) {
    return `${(squareMeters / 1_000_000).toFixed(2)} km²`;
  }
  if (squareMeters >= 10) return `${Math.round(squareMeters)} m²`;
  return `${squareMeters.toFixed(1)} m²`;
}

export function formatElevationDelta(meters: number): string {
  const rounded = Math.round(meters);
  if (rounded === 0) return "0 m";
  return `${rounded > 0 ? "+" : ""}${rounded} m`;
}
