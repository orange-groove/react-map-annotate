export interface ArcgisScreenPoint {
  x: number;
  y: number;
}

export interface ArcgisMapPoint {
  longitude?: number;
  latitude?: number;
  x?: number;
  y?: number;
}

export interface ArcgisViewEvent {
  x?: number;
  y?: number;
  native?: Event;
  mapPoint?: ArcgisMapPoint;
  stopPropagation?: () => void;
  preventDefault?: () => void;
}

export interface ArcgisHandle {
  remove: () => void;
}

export interface ArcgisView {
  container: HTMLElement | null;
  toScreen: (geometry: unknown) => ArcgisScreenPoint | null | undefined;
  toMap: (screen: ArcgisScreenPoint) => ArcgisMapPoint | null | undefined;
  on: (type: string, handler: (event: ArcgisViewEvent) => void) => ArcgisHandle;
  watch?: (path: string, handler: () => void) => ArcgisHandle;
  navigation?: {
    browserTouchPanEnabled?: boolean;
  };
  updating?: boolean;
  rotation?: number;
  scale?: number;
  width?: number;
  height?: number;
  extent?: {
    xmin?: number;
    ymin?: number;
    xmax?: number;
    ymax?: number;
  };
}

export function viewRenderKey(view: ArcgisView): string {
  try {
    const extent = view.extent;
    return [
      extent?.xmin,
      extent?.ymin,
      extent?.xmax,
      extent?.ymax,
      view.rotation,
      view.scale,
      view.width,
      view.height,
      view.updating ? 1 : 0,
    ].join(",");
  } catch {
    return "";
  }
}

const WEB_MERCATOR = 6378137;
const MAX_MERCATOR_LAT = 85.05112878;

export function lngLatToWebMercator(
  lng: number,
  lat: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const x = ((lng * Math.PI) / 180) * WEB_MERCATOR;
  const phi = (clamped * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + phi / 2)) * WEB_MERCATOR;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function projectLngLatToView(
  view: ArcgisView,
  lngLat: { lng: number; lat: number },
): ArcgisScreenPoint | null {
  try {
    const width =
      view.width ||
      (view.container instanceof HTMLElement ? view.container.clientWidth : 0);
    const height =
      view.height ||
      (view.container instanceof HTMLElement ? view.container.clientHeight : 0);
    const extent = view.extent;
    const xmin = extent?.xmin;
    const xmax = extent?.xmax;
    const ymin = extent?.ymin;
    const ymax = extent?.ymax;
    if (
      !width ||
      !height ||
      xmin == null ||
      xmax == null ||
      ymin == null ||
      ymax == null ||
      xmax === xmin ||
      ymax === ymin
    ) {
      return null;
    }

    let xMap = lngLat.lng;
    let yMap = lngLat.lat;
    if (Math.abs(xmin) > 180 || Math.abs(xmax) > 180) {
      const mercator = lngLatToWebMercator(lngLat.lng, lngLat.lat);
      if (!mercator) return null;
      xMap = mercator.x;
      yMap = mercator.y;
    }

    return {
      x: ((xMap - xmin) / (xmax - xmin)) * width,
      y: ((ymax - yMap) / (ymax - ymin)) * height,
    };
  } catch {
    return null;
  }
}

export function screenPointFromGeometry(
  toScreen: ArcgisView["toScreen"],
  lngLat: { lng: number; lat: number },
): ArcgisScreenPoint | null {
  const mercator = lngLatToWebMercator(lngLat.lng, lngLat.lat);
  const geometries: unknown[] = [];
  if (mercator) {
    geometries.push({
      type: "point",
      x: mercator.x,
      y: mercator.y,
      spatialReference: { wkid: 3857 },
    });
  }
  geometries.push({
    type: "point",
    longitude: lngLat.lng,
    latitude: lngLat.lat,
  });

  for (const geometry of geometries) {
    try {
      const pixel = toScreen(geometry);
      if (pixel && Number.isFinite(pixel.x) && Number.isFinite(pixel.y)) {
        return { x: pixel.x, y: pixel.y };
      }
    } catch {
      // mapview:projection-not-possible
    }
  }
  return null;
}

export function webMercatorToLngLat(
  x: number,
  y: number,
): { lng: number; lat: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const lng = (x / WEB_MERCATOR) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / WEB_MERCATOR)) - Math.PI / 2) * (180 / Math.PI);
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90
  ) {
    return null;
  }
  return { lng, lat };
}

export function lngLatFromMapPoint(
  point: ArcgisMapPoint | null | undefined,
): { lng: number; lat: number } | null {
  if (!point) return null;
  if (
    point.longitude != null &&
    point.latitude != null &&
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.longitude) <= 180 &&
    Math.abs(point.latitude) <= 90
  ) {
    return { lng: point.longitude, lat: point.latitude };
  }
  const x = point.x;
  const y = point.y;
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    return webMercatorToLngLat(x, y);
  }
  return { lng: x, lat: y };
}

export function screenPointFromEvent(
  event: ArcgisViewEvent,
): ArcgisScreenPoint | null {
  if (
    event.x == null ||
    event.y == null ||
    !Number.isFinite(event.x) ||
    !Number.isFinite(event.y)
  ) {
    return null;
  }
  return { x: event.x, y: event.y };
}
