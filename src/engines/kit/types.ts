import type { ComponentType, CSSProperties, ReactNode } from "react";
import type {
  AnnotateProps,
  LngLat,
  MapEngine,
  MapLngLat,
  MapPoint,
} from "../../core/types";

export type { MapEngine, MapLngLat, MapPoint } from "../../core/types";

export type GlAnnotateLayersProps = Pick<
  AnnotateProps,
  | "annotations"
  | "draft"
  | "selectedId"
  | "selectedIds"
  | "defaultColor"
  | "defaultStrokeWidth"
  | "labelsEditable"
  | "showLabels"
  | "showArea"
  | "renderArrowHead"
  | "renderLabel"
  | "onSelect"
  | "onLabelChange"
  | "onUpdate"
> & {
  hoveredId?: string | null;
  tracePreview?: LngLat[] | null;
  onHandleDragEnd?: (id: string) => void;
};

export interface MapLike {
  project: (lngLat: MapLngLat) => MapPoint;
  unproject: (point: [number, number] | MapPoint) => MapLngLat;
  getCanvas: () => HTMLElement;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  queryRenderedFeatures: (
    geometry?:
      | MapPoint
      | [number, number]
      | [MapPoint | [number, number], MapPoint | [number, number]],
    options?: { layers?: string[] },
  ) => Array<{
    properties?: { id?: unknown };
    geometry?: GeoJSON.Geometry;
    layer?: { id?: string; type?: string };
    sourceLayer?: string;
    source?: string;
  }>;
  querySourceFeatures?: (
    source: string,
    options?: { sourceLayer?: string },
  ) => Array<{
    properties?: { id?: unknown };
    geometry?: GeoJSON.Geometry;
    layer?: { id?: string; type?: string };
    sourceLayer?: string;
  }>;
  getStyle?: () => { layers?: Array<{ id: string; type: string }> };
  queryTerrainElevation?: (
    lngLat: MapLngLat,
    options?: { exaggerated?: boolean },
  ) => number | null | undefined;
  isStyleLoaded: () => boolean;
  getTerrain: () => unknown;
  setTerrain: (
    terrain: { source: string; exaggeration?: number } | null,
  ) => void;
  dragPan: {
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
  };
  boxZoom?: {
    enable: () => void;
    disable: () => void;
    isEnabled?: () => boolean;
  };
  on: (type: string, listener: (event: MapPointerEvent) => void) => void;
  off: (type: string, listener: (event: MapPointerEvent) => void) => void;
  getOverlayHost?: () => HTMLElement | null;
  projectDiv?: (lngLat: MapLngLat) => MapPoint;
  subscribeRender?: (listener: () => void) => () => void;
}

export interface MapPointerEvent {
  originalEvent: MouseEvent;
  point: MapPoint;
  lngLat: MapLngLat;
  preventDefault: () => void;
  target: MapLike;
}

export interface MapRef {
  getMap: () => MapLike;
}

export interface MarkerClickEvent {
  originalEvent: MouseEvent;
}

export interface GlMarkerProps {
  longitude: number;
  latitude: number;
  anchor?: string;
  offset?: [number, number];
  rotationAlignment?: "map" | "viewport" | "auto";
  pitchAlignment?: "map" | "viewport" | "auto";
  color?: string;
  scale?: number;
  style?: CSSProperties;
  onClick?: (event: MarkerClickEvent) => void;
  children?: ReactNode;
}

export interface GlSourceProps {
  id: string;
  type: string;
  data?: unknown;
  url?: string;
  tiles?: string[];
  tileSize?: number;
  maxzoom?: number;
  children?: ReactNode;
}

export interface GlLayerProps {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: unknown;
}

export interface GlKit {
  engine: MapEngine;
  Source: ComponentType<GlSourceProps>;
  Layer: ComponentType<GlLayerProps>;
  Marker: ComponentType<GlMarkerProps>;
  useMap: () => { current?: MapRef | null };
  Layers?: ComponentType<GlAnnotateLayersProps>;
}
