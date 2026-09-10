import type {
  AnnotateFont,
  AnnotateTool,
  AnnotationKind,
  DrawMode,
} from "./types";

export const LAYER_PREFIX = "rma";

export const SOURCE_IDS = {
  lines: `${LAYER_PREFIX}-lines`,
  fills: `${LAYER_PREFIX}-fills`,
  dashed: `${LAYER_PREFIX}-dashed`,
  bounds: `${LAYER_PREFIX}-bounds`,
  samples: `${LAYER_PREFIX}-samples`,
  terrain: `${LAYER_PREFIX}-terrain`,
  trace: `${LAYER_PREFIX}-trace`,
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
  trace: `${LAYER_PREFIX}-trace`,
  traceHalo: `${LAYER_PREFIX}-trace-halo`,
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
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 16;
export const DEFAULT_ARROW_HEAD_SIZE = 26;
export const MIN_ARROW_HEAD_SIZE = 12;
export const DEFAULT_STROKE_OPACITY = 0.95;
export const DEFAULT_HOVER_FILL_OPACITY = 0.18;

export function clampStrokeWidth(width: number): number {
  return Math.min(
    MAX_STROKE_WIDTH,
    Math.max(MIN_STROKE_WIDTH, Math.round(width)),
  );
}

export function arrowHeadSize(strokeWidth = DEFAULT_STROKE_WIDTH): number {
  return Math.max(
    MIN_ARROW_HEAD_SIZE,
    Math.round(
      (clampStrokeWidth(strokeWidth) / DEFAULT_STROKE_WIDTH) *
        DEFAULT_ARROW_HEAD_SIZE,
    ),
  );
}

export const DEFAULT_FONT_SIZE = 28;
export const MIN_TEXT_FONT_SIZE = 12;
export const MAX_TEXT_FONT_SIZE = 160;
export const SAMPLE_INTERVAL_METERS = 10;
export const HANDLE_HIT_PX = 20;
export const DUPLICATE_OFFSET_PX = 32;
export const TRACE_PIXEL_TOLERANCE = 32;
export const TRACE_STITCH_METERS = 24;
export const MAPBOX_TERRAIN_DEM = "mapbox://mapbox.mapbox-terrain-dem-v1";
export const EARTH_RADIUS_M = 6_371_000;

export const DRAW_TOOLS: AnnotateTool[] = [
  "draw",
  "trace",
  "line",
  "arrow",
  "bidirectional-arrow",
  "circle",
  "rectangle",
  "polygon",
  "measure",
  "marker",
  "text",
];

/**
 * Two-point shapes. `drawMode` decides whether their two points come from two
 * clicks or from one press-drag-release.
 */
export const DUAL_GESTURE_TOOLS: DualGestureTool[] = [
  "line",
  "arrow",
  "bidirectional-arrow",
  "circle",
  "rectangle",
  "measure",
];

export type DualGestureTool =
  "line" | "arrow" | "bidirectional-arrow" | "circle" | "rectangle" | "measure";

export const DEFAULT_DRAW_MODE: DrawMode = "click";

export const DEFAULT_TOOLBAR_TOOLS: AnnotateTool[] = [
  "select",
  "draw",
  "trace",
  "line",
  "arrow",
  "bidirectional-arrow",
  "circle",
  "rectangle",
  "polygon",
  "measure",
  "marker",
  "text",
];

export const IDLE_TOOL: AnnotateTool = "pan";

export const TOOL_LABELS: Record<AnnotateTool, string> = {
  pan: "Pan",
  select: "Select",
  draw: "Freehand",
  trace: "Trace",
  line: "Line",
  arrow: "Arrow",
  "bidirectional-arrow": "Bidirectional Arrow",
  circle: "Circle",
  rectangle: "Rectangle",
  polygon: "Polygon",
  measure: "Measure",
  marker: "Marker",
  text: "Text",
};

export const DEFAULT_LABELS: Record<AnnotationKind, string> = {
  draw: "Drawing",
  trace: "Trace",
  line: "Line",
  arrow: "Arrow",
  "bidirectional-arrow": "Bidirectional Arrow",
  circle: "Circle",
  rectangle: "Rectangle",
  polygon: "Polygon",
  measure: "Measure",
  marker: "Marker",
  text: "Text",
};

export const TEXT_FONTS: AnnotateFont[] = [
  { family: "", label: "System" },
  { family: "Georgia, serif", label: "Georgia" },
  { family: '"Times New Roman", Times, serif', label: "Times" },
  { family: "Arial, Helvetica, sans-serif", label: "Arial" },
  { family: '"Courier New", Courier, monospace', label: "Courier" },
  { family: '"Comic Sans MS", cursive', label: "Comic Sans" },
  { family: "Impact, Haettenschweiler, sans-serif", label: "Impact" },
];

/** @deprecated Use TEXT_FONTS */
export const TEXT_FONT_OPTIONS = TEXT_FONTS.map((font) => ({
  value: font.family,
  label: font.label ?? font.family,
}));

export function isIdleTool(tool: AnnotateTool | undefined): boolean {
  return tool == null || tool === IDLE_TOOL;
}

export function isDrawingTool(tool: AnnotateTool | undefined): boolean {
  return tool != null && tool !== "select" && tool !== IDLE_TOOL;
}

export function emptyClickClearsSelection(
  tool: AnnotateTool | undefined,
  additive = false,
  draft: unknown = null,
): boolean {
  return !isDrawingTool(tool) && !additive && draft == null;
}

export function toggleAnnotateTool(
  current: AnnotateTool | undefined,
  next: AnnotateTool,
): AnnotateTool {
  return current === next ? IDLE_TOOL : next;
}

export function isDualGestureTool(tool: AnnotateTool): tool is DualGestureTool {
  return (DUAL_GESTURE_TOOLS as readonly AnnotateTool[]).includes(tool);
}

/** Freehand is always a drag. The two-point shapes are only in `drag` mode. */
export function isDragTool(
  tool: AnnotateTool,
  drawMode: DrawMode = DEFAULT_DRAW_MODE,
): tool is "draw" | DualGestureTool {
  if (tool === "draw") return true;
  return drawMode === "drag" && isDualGestureTool(tool);
}

/** Polygon always takes a click per vertex. The two-point shapes in `click`. */
export function isClickVertexTool(
  tool: AnnotateTool,
  drawMode: DrawMode = DEFAULT_DRAW_MODE,
): tool is "polygon" | DualGestureTool {
  if (tool === "polygon") return true;
  return drawMode === "click" && isDualGestureTool(tool);
}

export function isPointTool(
  tool: AnnotateTool | AnnotationKind,
): tool is "marker" | "text" {
  return tool === "marker" || tool === "text";
}

export function isTraceTool(tool: AnnotateTool | undefined): boolean {
  return tool === "trace";
}

export function isAnnotateLayerId(layerId: string | undefined): boolean {
  return Boolean(layerId?.startsWith(`${LAYER_PREFIX}-`));
}
