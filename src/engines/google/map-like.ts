import type {
  MapLike,
  MapLngLat,
  MapPoint,
  MapPointerEvent,
} from "../kit/types";

type GoogleMapsApi = typeof google.maps;
type GoogleMap = google.maps.Map;
type MapsEventListener = google.maps.MapsEventListener;

const likes = new WeakMap<GoogleMap, MapLike>();

const POINTER_EVENTS = new Set([
  "click",
  "dblclick",
  "mousedown",
  "mousemove",
  "mouseup",
  "contextmenu",
]);

function mapsApi(): GoogleMapsApi {
  const maps = globalThis.google?.maps;
  if (!maps) {
    throw new Error("Google Maps JavaScript API is not loaded.");
  }
  return maps;
}

function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function mercatorLat(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

function createGoogleMapLike(map: GoogleMap): MapLike {
  const maps = mapsApi();
  const overlay = new maps.OverlayView();
  const renderListeners = new Set<() => void>();
  const listenerEntries = new Map<
    (event: MapPointerEvent) => void,
    MapsEventListener[]
  >();
  const moveListeners = new Set<(event: MapPointerEvent) => void>();
  let host: HTMLDivElement | null = null;
  let lastPointer: PointerEvent | null = null;
  let projectionReady = false;
  let replayedPointer = false;
  let panEnabled = true;
  const initialOptions = {
    gestureHandling: "greedy",
    draggable: true,
    disableDoubleClickZoom: false,
  };

  function projection() {
    return overlay.getProjection();
  }

  function projectFromBounds(lngLat: MapLngLat): MapPoint | null {
    const bounds = map.getBounds();
    const div = map.getDiv();
    if (!bounds || !div || div.clientWidth <= 0 || div.clientHeight <= 0) {
      return null;
    }
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const west = sw.lng();
    let east = ne.lng();
    if (east < west) east += 360;
    let lng = lngLat.lng;
    if (lng < west) lng += 360;
    const top = mercatorY(ne.lat());
    const bottom = mercatorY(sw.lat());
    return {
      x: ((lng - west) / (east - west)) * div.clientWidth,
      y: ((mercatorY(lngLat.lat) - top) / (bottom - top)) * div.clientHeight,
    };
  }

  function unprojectFromBounds(point: MapPoint): MapLngLat | null {
    const bounds = map.getBounds();
    const div = map.getDiv();
    if (!bounds || !div || div.clientWidth <= 0 || div.clientHeight <= 0) {
      return null;
    }
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const west = sw.lng();
    let east = ne.lng();
    if (east < west) east += 360;
    const top = mercatorY(ne.lat());
    const bottom = mercatorY(sw.lat());
    const lng = west + (point.x / div.clientWidth) * (east - west);
    return {
      lng: ((((lng + 180) % 360) + 360) % 360) - 180,
      lat: mercatorLat(top + (point.y / div.clientHeight) * (bottom - top)),
    };
  }

  function projectPoint(lngLat: MapLngLat): MapPoint {
    const proj = projection();
    if (proj) {
      const pixel = proj.fromLatLngToContainerPixel(
        new maps.LatLng(lngLat.lat, lngLat.lng),
      );
      if (pixel) return { x: pixel.x, y: pixel.y };
    }
    return projectFromBounds(lngLat) ?? { x: 0, y: 0 };
  }

  function unprojectPoint(point: MapPoint): MapLngLat {
    const proj = projection();
    if (proj) {
      const latLng = proj.fromContainerPixelToLatLng(
        new maps.Point(point.x, point.y),
      );
      if (latLng) return { lng: latLng.lng(), lat: latLng.lat() };
    }
    return unprojectFromBounds(point) ?? { lng: 0, lat: 0 };
  }

  function toPointerEvent(
    event: google.maps.MapMouseEvent,
  ): MapPointerEvent | null {
    const latLng = event.latLng;
    if (!latLng) return null;
    const next = { lng: latLng.lng(), lat: latLng.lat() };
    const pixel = projectPoint(next);
    const originalEvent = (event.domEvent ??
      new MouseEvent("click")) as MouseEvent;
    return {
      originalEvent,
      point: pixel,
      lngLat: next,
      preventDefault: () => {
        event.stop();
        originalEvent.preventDefault();
      },
      target: like,
    };
  }

  function pointerToEvent(event: PointerEvent): MapPointerEvent | null {
    const rect = map.getDiv().getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const lngLat = unprojectPoint(point);
    if (lngLat.lng === 0 && lngLat.lat === 0 && !map.getBounds()) return null;
    return {
      originalEvent: event as unknown as MouseEvent,
      point,
      lngLat,
      preventDefault: () => event.preventDefault(),
      target: like,
    };
  }

  function emitPointerMove(event: PointerEvent) {
    lastPointer = event;
    if (moveListeners.size === 0) return;
    const next = pointerToEvent(event);
    if (!next) return;
    for (const listener of moveListeners) listener(next);
  }

  overlay.onAdd = function onAdd() {
    if (!host) {
      host = document.createElement("div");
      host.className = "rma-google-overlay";
    }
    const panes = this.getPanes();
    const parent =
      panes?.overlayLayer ??
      panes?.floatPane ??
      panes?.overlayMouseTarget ??
      map.getDiv().querySelector(".gm-style") ??
      map.getDiv();
    if (parent && host.parentElement !== parent) parent.appendChild(host);
  };
  overlay.draw = function onDraw() {
    if (overlay.getProjection()) projectionReady = true;
    for (const listener of renderListeners) listener();
    if (projectionReady && lastPointer && !replayedPointer) {
      replayedPointer = true;
      emitPointerMove(lastPointer);
    }
  };
  overlay.onRemove = function onRemove() {
    host?.remove();
    host = null;
  };

  function overlayReady() {
    return Boolean(overlay.getProjection() && host?.isConnected);
  }

  function ensureOverlay(reset = false) {
    if (overlayReady()) return;
    try {
      if (reset && overlay.getMap()) overlay.setMap(null);
      if (!overlay.getMap()) overlay.setMap(map);
    } catch {
      // Map can be torn down while the first tiles are still loading.
    }
  }

  map.getDiv().addEventListener("pointermove", emitPointerMove, true);
  maps.event.addListenerOnce(map, "idle", () => ensureOverlay(true));
  maps.event.addListenerOnce(map, "tilesloaded", () => ensureOverlay(true));
  overlay.setMap(map);

  const like: MapLike = {
    project: projectPoint,
    unproject(point: [number, number] | MapPoint): MapLngLat {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      return unprojectPoint({ x, y });
    },
    getCanvas: () => {
      const div = map.getDiv();
      if (!(div instanceof HTMLElement)) {
        throw new Error("Google map container is not ready.");
      }
      return div;
    },
    getLayer: () => undefined,
    getSource: () => undefined,
    queryRenderedFeatures: () => [],
    isStyleLoaded: () => overlayReady(),
    getTerrain: () => null,
    setTerrain: () => undefined,
    dragPan: {
      enable: () => {
        panEnabled = true;
        map.setOptions({
          gestureHandling: initialOptions.gestureHandling,
          draggable: true,
        });
      },
      disable: () => {
        panEnabled = false;
        map.setOptions({ gestureHandling: "none", draggable: false });
      },
      isEnabled: () => panEnabled,
    },
    getOverlayHost: () => host,
    projectDiv: (lngLat: MapLngLat): MapPoint => {
      const proj = projection();
      if (proj) {
        const pixel = proj.fromLatLngToDivPixel(
          new maps.LatLng(lngLat.lat, lngLat.lng),
        );
        if (pixel) return { x: pixel.x, y: pixel.y };
      }
      return projectFromBounds(lngLat) ?? { x: 0, y: 0 };
    },
    subscribeRender: (listener) => {
      renderListeners.add(listener);
      return () => {
        renderListeners.delete(listener);
      };
    },
    on: (type, listener) => {
      if (type === "mousemove") moveListeners.add(listener);
      const handle = map.addListener(
        type,
        (event?: google.maps.MapMouseEvent) => {
          if (POINTER_EVENTS.has(type)) {
            if (!event) return;
            const next = toPointerEvent(event);
            if (next) listener(next);
            return;
          }
          listener({
            originalEvent: new MouseEvent(type),
            point: { x: 0, y: 0 },
            lngLat: { lng: 0, lat: 0 },
            preventDefault: () => undefined,
            target: like,
          });
        },
      );
      const current = listenerEntries.get(listener) ?? [];
      current.push(handle);
      listenerEntries.set(listener, current);
    },
    off: (type, listener) => {
      if (type === "mousemove") moveListeners.delete(listener);
      const current = listenerEntries.get(listener);
      if (!current) return;
      for (const handle of current) handle.remove();
      listenerEntries.delete(listener);
    },
  };

  return like;
}

export function getGoogleMapLike(map: GoogleMap): MapLike {
  const existing = likes.get(map);
  if (existing) return existing;
  const like = createGoogleMapLike(map);
  likes.set(map, like);
  return like;
}
