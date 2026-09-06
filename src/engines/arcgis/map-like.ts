import type {
  MapLike,
  MapLngLat,
  MapPoint,
  MapPointerEvent,
} from "../kit/types";
import {
  lngLatFromMapPoint,
  screenPointFromEvent,
  projectLngLatToView,
  screenPointFromGeometry,
  type ArcgisHandle,
  type ArcgisScreenPoint,
  type ArcgisView,
  type ArcgisViewEvent,
} from "./view";

const likes = new WeakMap<ArcgisView, MapLike>();

const POINTER_EVENTS: Record<string, string> = {
  mousedown: "pointer-down",
  mousemove: "pointer-move",
  mouseup: "pointer-up",
  click: "click",
  dblclick: "double-click",
};

const RENDER_WATCHES = [
  "extent",
  "rotation",
  "size",
  "viewpoint",
  "scale",
  "updating",
  "stationary",
] as const;

const RENDER_EVENTS = ["resize", "drag", "mouse-wheel"] as const;

function ensureOverlayHost(view: ArcgisView): HTMLElement | null {
  const container = view.container;
  if (!(container instanceof HTMLElement)) return null;
  const existing = container.querySelector<HTMLElement>(".rmga-arcgis-overlay");
  if (existing) return existing;

  const host = document.createElement("div");
  host.className = "rmga-arcgis-overlay";
  container.appendChild(host);
  return host;
}

function safeToMap(view: ArcgisView, screen: ArcgisScreenPoint) {
  try {
    return view.toMap(screen);
  } catch {
    return null;
  }
}

function releaseHandle(handle: ArcgisHandle | null | undefined) {
  try {
    handle?.remove();
  } catch {
    // View may already be destroyed.
  }
}

function createArcgisMapLike(view: ArcgisView): MapLike {
  const listenerEntries = new Map<
    (event: MapPointerEvent) => void,
    ArcgisHandle[]
  >();
  const renderListeners = new Set<() => void>();
  const renderHandles: ArcgisHandle[] = [];
  let renderFrame = 0;
  const canvas =
    view.container instanceof HTMLElement
      ? view.container
      : document.createElement("div");

  let panEnabled = true;
  let dragHandle: ArcgisHandle | null = null;
  const previousTouchPan = view.navigation?.browserTouchPanEnabled;

  function toPointerEvent(event: ArcgisViewEvent): MapPointerEvent | null {
    const screen = screenPointFromEvent(event);
    if (!screen) return null;
    const lngLat =
      lngLatFromMapPoint(event.mapPoint) ??
      lngLatFromMapPoint(safeToMap(view, screen));
    if (!lngLat) return null;
    const originalEvent = (
      event.native instanceof MouseEvent
        ? event.native
        : new MouseEvent("click")
    ) as MouseEvent;
    return {
      originalEvent,
      point: screen,
      lngLat,
      preventDefault: () => {
        event.stopPropagation?.();
        event.preventDefault?.();
        originalEvent.preventDefault();
      },
      target: like,
    };
  }

  function notifyRender() {
    for (const listener of renderListeners) listener();
  }

  function startRenderWatches() {
    if (renderFrame !== 0) return;
    const pulse = () => {
      try {
        notifyRender();
      } catch {
        // Keep the loop alive if a subscriber throws.
      }
      renderFrame = requestAnimationFrame(pulse);
    };
    renderFrame = requestAnimationFrame(pulse);

    if (typeof view.watch === "function") {
      for (const path of RENDER_WATCHES) {
        try {
          renderHandles.push(view.watch(path, notifyRender));
        } catch {
          // Property may not exist on this view.
        }
      }
    }
    for (const type of RENDER_EVENTS) {
      try {
        renderHandles.push(view.on(type, notifyRender));
      } catch {
        // Event may not exist on this view.
      }
    }
  }

  function stopRenderWatches() {
    if (renderFrame !== 0) {
      cancelAnimationFrame(renderFrame);
      renderFrame = 0;
    }
    for (const handle of renderHandles) releaseHandle(handle);
    renderHandles.length = 0;
  }

  const like: MapLike = {
    project(lngLat: MapLngLat): MapPoint {
      return (
        projectLngLatToView(view, lngLat) ??
        screenPointFromGeometry(view.toScreen.bind(view), lngLat) ?? {
          x: 0,
          y: 0,
        }
      );
    },
    unproject(point: [number, number] | MapPoint): MapLngLat {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      return (
        lngLatFromMapPoint(safeToMap(view, { x, y })) ?? { lng: 0, lat: 0 }
      );
    },
    getCanvas: () =>
      view.container instanceof HTMLElement ? view.container : canvas,
    getLayer: () => undefined,
    getSource: () => undefined,
    queryRenderedFeatures: () => [],
    isStyleLoaded: () => true,
    getTerrain: () => null,
    setTerrain: () => undefined,
    dragPan: {
      enable: () => {
        panEnabled = true;
        try {
          if (view.navigation && previousTouchPan != null) {
            view.navigation.browserTouchPanEnabled = previousTouchPan;
          }
        } catch {
          // View may already be destroyed.
        }
        releaseHandle(dragHandle);
        dragHandle = null;
      },
      disable: () => {
        panEnabled = false;
        try {
          if (view.navigation) {
            view.navigation.browserTouchPanEnabled = false;
          }
          releaseHandle(dragHandle);
          dragHandle = view.on("drag", (event) => {
            event.stopPropagation?.();
          });
        } catch {
          dragHandle = null;
        }
      },
      isEnabled: () => panEnabled,
    },
    getOverlayHost: () => ensureOverlayHost(view),
    projectDiv: (lngLat: MapLngLat): MapPoint => like.project(lngLat),
    subscribeRender: (listener) => {
      renderListeners.add(listener);
      startRenderWatches();
      return () => {
        renderListeners.delete(listener);
        if (renderListeners.size === 0) stopRenderWatches();
      };
    },
    on: (type, listener) => {
      const mapped = POINTER_EVENTS[type] ?? type;
      const handle = view.on(mapped, (event) => {
        if (type in POINTER_EVENTS) {
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
      });
      const current = listenerEntries.get(listener) ?? [];
      current.push(handle);
      listenerEntries.set(listener, current);
    },
    off: (_type, listener) => {
      const current = listenerEntries.get(listener);
      if (!current) return;
      for (const handle of current) releaseHandle(handle);
      listenerEntries.delete(listener);
    },
  };

  return like;
}

export function getArcgisMapLike(view: ArcgisView): MapLike {
  const existing = likes.get(view);
  if (existing) return existing;
  const like = createArcgisMapLike(view);
  likes.set(view, like);
  return like;
}
