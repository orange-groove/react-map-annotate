import L from "leaflet";
import type {
  MapLike,
  MapLngLat,
  MapPoint,
  MapPointerEvent,
} from "../kit/types";

type LeafletMap = L.Map;

const likes = new WeakMap<LeafletMap, MapLike>();

const POINTER_EVENTS = new Set([
  "click",
  "dblclick",
  "mousedown",
  "mousemove",
  "mouseup",
  "contextmenu",
]);

function createLeafletMapLike(map: LeafletMap): MapLike {
  const listenerEntries = new Map<
    (event: MapPointerEvent) => void,
    Array<{ type: string; handler: L.LeafletEventHandlerFn }>
  >();

  const like: MapLike = {
    project(lngLat: MapLngLat): MapPoint {
      const pixel = map.latLngToContainerPoint([lngLat.lat, lngLat.lng]);
      return { x: pixel.x, y: pixel.y };
    },
    unproject(point: [number, number] | MapPoint): MapLngLat {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      const latLng = map.containerPointToLatLng([x, y]);
      return { lng: latLng.lng, lat: latLng.lat };
    },
    getCanvas: () => map.getContainer(),
    getLayer: () => undefined,
    getSource: () => undefined,
    queryRenderedFeatures: () => [],
    isStyleLoaded: () => true,
    getTerrain: () => null,
    setTerrain: () => undefined,
    dragPan: {
      enable: () => {
        map.dragging.enable();
      },
      disable: () => {
        map.dragging.disable();
      },
      isEnabled: () => map.dragging.enabled(),
    },
    boxZoom: {
      enable: () => {
        map.boxZoom.enable();
      },
      disable: () => {
        map.boxZoom.disable();
      },
      isEnabled: () => map.boxZoom.enabled(),
    },
    on: (type, listener) => {
      const handler: L.LeafletEventHandlerFn = (event) => {
        if (POINTER_EVENTS.has(type)) {
          const mouse = event as L.LeafletMouseEvent;
          if (!mouse.latlng || !mouse.containerPoint) return;
          listener({
            originalEvent: mouse.originalEvent,
            point: { x: mouse.containerPoint.x, y: mouse.containerPoint.y },
            lngLat: { lng: mouse.latlng.lng, lat: mouse.latlng.lat },
            preventDefault: () => {
              L.DomEvent.stop(mouse);
              mouse.originalEvent.preventDefault();
            },
            target: like,
          });
          return;
        }
        listener({
          originalEvent: new MouseEvent(type),
          point: { x: 0, y: 0 },
          lngLat: { lng: 0, lat: 0 },
          preventDefault: () => undefined,
          target: like,
        });
      };
      map.on(type, handler);
      const current = listenerEntries.get(listener) ?? [];
      current.push({ type, handler });
      listenerEntries.set(listener, current);
    },
    off: (_type, listener) => {
      const current = listenerEntries.get(listener);
      if (!current) return;
      for (const entry of current) {
        map.off(entry.type, entry.handler);
      }
      listenerEntries.delete(listener);
    },
  };

  return like;
}

export function getLeafletMapLike(map: LeafletMap): MapLike {
  const existing = likes.get(map);
  if (existing) return existing;
  const like = createLeafletMapLike(map);
  likes.set(map, like);
  return like;
}
