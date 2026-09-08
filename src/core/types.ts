import type { CSSProperties, ReactNode } from "react";

export type MapEngine = "mapbox" | "maplibre" | "google" | "leaflet" | "arcgis";

export interface MapPoint {
  x: number;
  y: number;
}

export interface TraceHit {
  id?: string;
  coordinates: LngLat[];
}

export interface TraceContext {
  map: TraceMap;
  point: MapPoint;
  phase: "hover" | "draw";
}

export type TraceFn = (
  lngLat: LngLat,
  context: TraceContext,
) =>
  | TraceHit
  | null
  | undefined
  | Promise<TraceHit | null | undefined>;

export interface TraceOptions {
  layers?: string[];
  pixelTolerance?: number;
}

export type TraceOption = boolean | TraceFn | TraceOptions;

export interface TraceMap {
  project: (lngLat: MapLngLat) => MapPoint;
  unproject: (point: [number, number] | MapPoint) => MapLngLat;
  getLayer: (id: string) => unknown;
  getStyle?: () => { layers?: Array<{ id: string; type: string }> };
  queryRenderedFeatures: (
    geometry?:
      | MapPoint
      | [number, number]
      | [MapPoint | [number, number], MapPoint | [number, number]],
    options?: { layers?: string[] },
  ) => Array<{
    geometry?: GeoJSON.Geometry;
    layer?: { id?: string; type?: string };
    sourceLayer?: string;
    source?: string;
    properties?: { id?: unknown };
  }>;
  querySourceFeatures?: (
    source: string,
    options?: { sourceLayer?: string },
  ) => Array<{
    geometry?: GeoJSON.Geometry;
    layer?: { id?: string; type?: string };
    sourceLayer?: string;
    properties?: { id?: unknown };
  }>;
}

export interface MapLngLat {
  lng: number;
  lat: number;
}

export type LngLat = [longitude: number, latitude: number];

export type AnnotateTool =
  | "pan"
  | "select"
  | "draw"
  | "trace"
  | "line"
  | "arrow"
  | "bidirectional-arrow"
  | "circle"
  | "rectangle"
  | "polygon"
  | "measure"
  | "marker"
  | "text";

export type AnnotationKind = Exclude<AnnotateTool, "pan" | "select">;

export interface AnnotationStyle {
  color?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface AnnotateFont {
  family: string;
  label?: string;
  stylesheet?: string;
  source?: string;
}

export interface ElevationSample {
  coordinate: LngLat;
  distanceAlongMeters: number;
  elevationMeters: number | null;
}

export interface Measurement {
  distanceMeters: number;
  samples: ElevationSample[];
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
}

interface AnnotationBase {
  id: string;
  label: string;
  style?: AnnotationStyle;
  groupId?: string;
}

export interface PathAnnotation extends AnnotationBase {
  kind: "draw" | "trace" | "line" | "arrow" | "bidirectional-arrow" | "measure";
  coordinates: LngLat[];
  measurement?: Measurement;
}

export interface AreaAnnotation extends AnnotationBase {
  kind: "polygon" | "rectangle" | "circle";
  coordinates: LngLat[];
  center?: LngLat;
  radiusMeters?: number;
}

export interface MarkerAnnotation extends AnnotationBase {
  kind: "marker";
  coordinate: LngLat;
}

export interface TextAnnotation extends AnnotationBase {
  kind: "text";
  coordinate: LngLat;
}

export type Annotation =
  PathAnnotation | AreaAnnotation | MarkerAnnotation | TextAnnotation;

export interface DraftAnnotation {
  kind: AnnotationKind;
  coordinates: LngLat[];
  cursor?: LngLat;
}

export interface ArrowHeadRenderProps {
  direction: "start" | "end";
  bearing: number;
  color: string;
  selected: boolean;
  size: number;
}

export interface SelectOptions {
  additive?: boolean;
}

export interface LabelRenderProps {
  annotation: Annotation;
  selected: boolean;
  editable: boolean;
  longitude: number;
  latitude: number;
  offset?: [number, number];
  areaLabel?: string | null;
  showLabel?: boolean;
  showArea?: boolean;
  onSelect?: (id: string, options?: SelectOptions) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
}

export interface AnnotateCallbacks {
  onAdd?: (annotation: Annotation) => void;
  onUpdate?: (annotation: Annotation) => void;
  onDelete?: (id: string) => void;
  onDraftChange?: (draft: DraftAnnotation | null) => void;
  onToolChange?: (tool: AnnotateTool) => void;
  onSelect?: (id: string | null, options?: SelectOptions) => void;
  onSelectIds?: (ids: string[]) => void;
  onLabelChange?: (id: string, label: string, annotation: Annotation) => void;
  onColorChange?: (id: string, color: string, annotation: Annotation) => void;
}

export interface TerrainSourceOptions {
  url?: string;
  tiles?: string[];
  tileSize?: number;
  maxzoom?: number;
  exaggeration?: number;
}

export interface AnnotateProps extends AnnotateCallbacks {
  annotations?: Annotation[];
  draft?: DraftAnnotation | null;
  tool?: AnnotateTool;
  selectedId?: string | null;
  selectedIds?: string[];
  defaultColor?: string;
  defaultStrokeWidth?: number;
  sampleIntervalMeters?: number;
  enableTerrain?: boolean;
  terrainSource?: TerrainSourceOptions;
  interactive?: boolean;
  labelsEditable?: boolean;
  showLabels?: boolean;
  showArea?: boolean;
  trace?: TraceOption;
  renderArrowHead?: (props: ArrowHeadRenderProps) => ReactNode;
  renderLabel?: (props: LabelRenderProps) => ReactNode;
}

export interface AnnotateToolbarProps {
  tool?: AnnotateTool;
  onToolChange?: (tool: AnnotateTool) => void;
  selectedId?: string | null;
  selectedIds?: string[];
  onDeleteSelected?: () => void;
  onFinish?: () => void;
  canFinish?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  orientation?: "vertical" | "horizontal";
  tools?: AnnotateTool[];
  className?: string;
  style?: CSSProperties;
}

export interface AnnotateListProps {
  annotations?: Annotation[];
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect?: (id: string, options?: SelectOptions) => void;
  onLabelChange?: (id: string, label: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onStyleChange?: (id: string, style: AnnotationStyle) => void;
  onDelete?: (id: string) => void;
  defaultColor?: string;
  emptyMessage?: string;
  fonts?: AnnotateFont[];
  className?: string;
  style?: CSSProperties;
}
