"use client";

export { Annotate } from "./components/annotate";
export { AnnotateLayers } from "./components/annotate-layers";
export { AnnotateToolbar } from "./components/annotate-toolbar";
export { AnnotateList } from "./components/annotate-list";
export { AnnotationLabel } from "./components/annotation-label";
export { DefaultArrowHead } from "./components/arrow-head";
export { AnnotateToolIcon } from "./components/tool-icon";
export { AnnotateProvider } from "./context/annotate-context";
export { useAnnotate, useOptionalAnnotate } from "./hooks/use-annotate";
export {
  useAnnotateItems,
  useAnnotateTools,
} from "./hooks/use-annotate-controls";
export type {
  AnnotateListItem,
  AnnotateToolItem,
} from "./hooks/use-annotate-controls";
export type {
  AnnotateProviderProps,
  AnnotateSession,
} from "./hooks/use-annotate";

export {
  LAYER_IDS,
  LAYER_PREFIX,
  SOURCE_IDS,
  SELECTABLE_LAYER_IDS,
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_LABELS,
  DEFAULT_TOOLBAR_TOOLS,
  TOOL_LABELS,
  DRAW_TOOLS,
  SAMPLE_INTERVAL_METERS,
  isDrawingTool,
  isDragTool,
  isClickVertexTool,
  isAnnotateLayerId,
} from "./constants";

export {
  haversineDistance,
  initialBearing,
  destination,
  interpolateGeodesic,
  pathLength,
  densifyPath,
  circleRing,
  rectangleRing,
  closeRing,
  openRing,
  sameLngLat,
  coordinateBounds,
  boundsRing,
  ringCentroid,
  pathMidpoint,
  formatDistance,
  formatElevationDelta,
  measurePath,
  queryGroundElevation,
  formatMeasurement,
  annotationFromDraft,
  previewCoordinates,
  labelAnchor,
  setAnnotationLabel,
  updateAnnotationLabel,
  setAnnotationStyle,
  setAnnotationColor,
  updateAnnotationColor,
  cssColorForInput,
  upsertAnnotation,
  removeAnnotation,
  canFinishDraft,
  canPressFinish,
  createAnnotationId,
  buildAnnotationFeatures,
  draftPolygonPreview,
  moveAnnotation,
  resizeRectangleVertex,
  movePolygonVertex,
  resizeCircle,
  circleResizeHandle,
  editableVertices,
} from "./utils";
export type { TerrainMap, ArrowMarker, AnnotationFeatures } from "./utils";

export type {
  LngLat,
  AnnotateTool,
  AnnotationKind,
  AnnotationStyle,
  ElevationSample,
  Measurement,
  PathAnnotation,
  AreaAnnotation,
  MarkerAnnotation,
  Annotation,
  DraftAnnotation,
  ArrowHeadRenderProps,
  AnnotateCallbacks,
  AnnotateProps,
  AnnotateToolbarProps,
  AnnotateListProps,
} from "./types";
