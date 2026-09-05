import type {
  MapLike,
  MapLngLat,
  MapPoint,
  MapPointerEvent,
} from "../gl/types";

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
]);

function mapsApi(): GoogleMapsApi {
  const maps = globalThis.google?.maps;
  if (!maps) {
    throw new Error("Google Maps JavaScript API is not loaded.");
  }
  return maps;
}

function createGoogleMapLike(map: GoogleMap): MapLike {
  const maps = mapsApi();
  const overlay = new maps.OverlayView();
  const renderListeners = new Set<() => void>();
  let host: HTMLDivElement | null = null;

  overlay.onAdd = function onAdd() {
    host = document.createElement("div");
    host.className = "rmga-google-overlay";
    this.getPanes()?.overlayMouseTarget.appendChild(host);
  };
  overlay.draw = function onDraw() {
    for (const listener of renderListeners) listener();
  };
  overlay.onRemove = function onRemove() {
    host?.remove();
    host = null;
  };
  overlay.setMap(map);

  const listenerEntries = new Map<
    (event: MapPointerEvent) => void,
    MapsEventListener[]
  >();

  let panEnabled = true;
  const initialOptions = {
    gestureHandling: "greedy",
    draggable: true,
    disableDoubleClickZoom: false,
  };

  function projection() {
    return overlay.getProjection();
  }

  function toPointerEvent(
    event: google.maps.MapMouseEvent,
  ): MapPointerEvent | null {
    const latLng = event.latLng;
    const proj = projection();
    if (!latLng || !proj) return null;
    const pixel = proj.fromLatLngToContainerPixel(latLng);
    if (!pixel) return null;
    const originalEvent = (event.domEvent ??
      new MouseEvent("click")) as MouseEvent;
    return {
      originalEvent,
      point: { x: pixel.x, y: pixel.y },
      lngLat: { lng: latLng.lng(), lat: latLng.lat() },
      preventDefault: () => {
        event.stop();
        originalEvent.preventDefault();
      },
      target: like,
    };
  }

  const like: MapLike = {
    project(lngLat: MapLngLat): MapPoint {
      const proj = projection();
      if (!proj) return { x: 0, y: 0 };
      const pixel = proj.fromLatLngToContainerPixel(
        new maps.LatLng(lngLat.lat, lngLat.lng),
      );
      return pixel ? { x: pixel.x, y: pixel.y } : { x: 0, y: 0 };
    },
    unproject(point: [number, number] | MapPoint): MapLngLat {
      const proj = projection();
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      if (!proj) return { lng: 0, lat: 0 };
      const latLng = proj.fromContainerPixelToLatLng(new maps.Point(x, y));
      return latLng
        ? { lng: latLng.lng(), lat: latLng.lat() }
        : { lng: 0, lat: 0 };
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
    isStyleLoaded: () => true,
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
      if (!proj) return { x: 0, y: 0 };
      const pixel = proj.fromLatLngToDivPixel(
        new maps.LatLng(lngLat.lat, lngLat.lng),
      );
      return pixel ? { x: pixel.x, y: pixel.y } : { x: 0, y: 0 };
    },
    subscribeRender: (listener) => {
      renderListeners.add(listener);
      return () => {
        renderListeners.delete(listener);
      };
    },
    on: (type, listener) => {
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
    off: (_type, listener) => {
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
