"use client";

export { AnnotateToolbar } from "./ui/annotate-toolbar";
export { AnnotateList } from "./ui/annotate-list";
export { DefaultArrowHead } from "./paint/arrow-head";
export { AnnotateToolIcon } from "./ui/tool-icon";
export { AnnotateProvider } from "./session/annotate-context";
export { useAnnotate, useOptionalAnnotate } from "./session/use-annotate";
export {
  useAnnotateItems,
  useAnnotateTools,
} from "./session/use-annotate-controls";
export type {
  AnnotateListItem,
  AnnotateToolItem,
} from "./session/use-annotate-controls";
export type {
  AnnotateProviderProps,
  AnnotateSession,
} from "./session/use-annotate";

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
  HANDLE_HIT_PX,
  MAPBOX_TERRAIN_DEM,
  isDrawingTool,
  isDragTool,
  isClickVertexTool,
  isAnnotateLayerId,
} from "./core/constants";

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
  movePathEndpoint,
  editHandlesFor,
  hitEditHandle,
  applyEditHandle,
  editHandleCursor,
  hitTestAnnotations,
} from "./core/utils";
export type {
  TerrainMap,
  ArrowMarker,
  AnnotationFeatures,
  PathEndpoint,
  EditHandleHit,
} from "./core/utils";

export type { MapEngine, MapLngLat, MapPoint } from "./core/types";

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
  TerrainSourceOptions,
} from "./core/types";
