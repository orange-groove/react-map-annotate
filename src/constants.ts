import type { AnnotateTool, AnnotationKind } from "./types";

export const LAYER_PREFIX = "rmga";

export const SOURCE_IDS = {
  lines: `${LAYER_PREFIX}-lines`,
  fills: `${LAYER_PREFIX}-fills`,
  dashed: `${LAYER_PREFIX}-dashed`,
  bounds: `${LAYER_PREFIX}-bounds`,
  samples: `${LAYER_PREFIX}-samples`,
  terrain: `${LAYER_PREFIX}-terrain`,
} as const;

export const LAYER_IDS = {
  line: `${LAYER_PREFIX}-line`,
  lineHit: `${LAYER_PREFIX}-line-hit`,
  fill: `${LAYER_PREFIX}-fill`,
  fillOutline: `${LAYER_PREFIX}-fill-outline`,
  dashed: `${LAYER_PREFIX}-dashed`,
  bounds: `${LAYER_PREFIX}-bounds`,
  boundsHit: `${LAYER_PREFIX}-bounds-hit`,
  samples: `${LAYER_PREFIX}-samples`,
} as const;

export const SELECTABLE_LAYER_IDS = [
  LAYER_IDS.lineHit,
  LAYER_IDS.line,
  LAYER_IDS.fill,
  LAYER_IDS.fillOutline,
  LAYER_IDS.boundsHit,
  LAYER_IDS.bounds,
] as const;

export const DEFAULT_COLOR = "#2563eb";
export const DEFAULT_STROKE_WIDTH = 3;
export const SAMPLE_INTERVAL_METERS = 10;
export const HANDLE_HIT_PX = 20;
export const MAPBOX_TERRAIN_DEM = "mapbox://mapbox.mapbox-terrain-dem-v1";
export const EARTH_RADIUS_M = 6_371_000;

export const DRAW_TOOLS: AnnotateTool[] = [
  "draw",
  "line",
  "arrow",
  "bidirectional-arrow",
  "circle",
  "rectangle",
  "polygon",
  "measure",
  "marker",
];

export const CLICK_VERTEX_TOOLS: AnnotationKind[] = [
  "line",
  "arrow",
  "bidirectional-arrow",
  "polygon",
  "measure",
];

export const DRAG_TOOLS: AnnotationKind[] = ["draw", "circle", "rectangle"];

export const DEFAULT_TOOLBAR_TOOLS: AnnotateTool[] = [
  "draw",
  "line",
  "arrow",
  "bidirectional-arrow",
  "circle",
  "rectangle",
  "polygon",
  "measure",
  "marker",
];

export const TOOL_LABELS: Record<AnnotateTool, string> = {
  select: "Select",
  draw: "Freehand",
  line: "Line",
  arrow: "Arrow",
  "bidirectional-arrow": "Bidirectional arrow",
  circle: "Circle",
  rectangle: "Rectangle",
  polygon: "Polygon",
  measure: "Measure",
  marker: "Marker",
};

export const DEFAULT_LABELS: Record<AnnotationKind, string> = {
  draw: "Drawing",
  line: "Line",
  arrow: "Arrow",
  "bidirectional-arrow": "Arrow",
  circle: "Circle",
  rectangle: "Rectangle",
  polygon: "Polygon",
  measure: "Measure",
  marker: "Marker",
};

export function isDrawingTool(tool: AnnotateTool | undefined): boolean {
  return tool != null && tool !== "select";
}

export function isDragTool(
  tool: AnnotateTool,
): tool is (typeof DRAG_TOOLS)[number] {
  return (DRAG_TOOLS as readonly AnnotateTool[]).includes(tool);
}

export function isClickVertexTool(
  tool: AnnotateTool,
): tool is (typeof CLICK_VERTEX_TOOLS)[number] {
  return (CLICK_VERTEX_TOOLS as readonly AnnotateTool[]).includes(tool);
}

export function isAnnotateLayerId(layerId: string | undefined): boolean {
  return Boolean(layerId?.startsWith(`${LAYER_PREFIX}-`));
}
