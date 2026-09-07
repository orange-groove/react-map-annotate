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
  ringArea,
  formatDistance,
  formatArea,
  formatElevationDelta,
} from "./geo";

export {
  measurePath,
  queryGroundElevation,
  formatMeasurement,
} from "./measure";
export type { TerrainMap } from "./measure";

export { createAnnotationId } from "./ids";

export {
  cloneAnnotation,
  serializeAnnotationClipboard,
  parseAnnotationClipboard,
  writeAnnotationClipboard,
  peekAnnotationClipboard,
  readAnnotationClipboard,
  placeAnnotationAt,
  offsetAnnotationByPixels,
  duplicateAnnotationRight,
  annotationIdFromTarget,
} from "./clipboard";

export {
  isPathAnnotation,
  isAreaAnnotation,
  annotationAreaMeters,
  isArrowAnnotation,
  isMarkerAnnotation,
  isTextAnnotation,
  previewCoordinates,
  committedDraftCoordinates,
  labelAnchor,
  setAnnotationLabel,
  updateAnnotationLabel,
  setAnnotationStyle,
  setAnnotationColor,
  updateAnnotationColor,
  cssColorForInput,
  upsertAnnotation,
  removeAnnotation,
  annotationFromDraft,
  minVerticesForKind,
  canFinishDraft,
  canPressFinish,
} from "./annotations";

export {
  offsetLngLat,
  moveAnnotation,
  textFontSize,
  clampTextFontSize,
  resizeText,
  textHitSize,
  resizeRectangleVertex,
  movePolygonVertex,
  resizeCircle,
  circleResizeHandle,
  drawBoundsRing,
  editableVertices,
  movePathEndpoint,
  movePathVertex,
  insertVertex,
  removeVertex,
  canInsertVertices,
  canRemoveVertex,
  insertHandlesFor,
  editHandlesFor,
  hitEditHandle,
  applyEditHandle,
  editHandleCursor,
} from "./edit";
export type { PathEndpoint, EditHandleHit } from "./edit";

export {
  buildAnnotationFeatures,
  draftAreaCoordinates,
  draftPolygonPreview,
} from "./features";
export type { ArrowMarker, AnnotationFeatures } from "./features";

export { hitTestAnnotations, distanceToSegment, pointInRing } from "./hit-test";

export {
  listTraceLayers,
  traceRenderedRoads,
  resolveTrace,
  stitchTrace,
  sameTracePath,
  asTraceFn,
} from "./trace";

export {
  resolveAnnotateFonts,
  fontPickerOptions,
  fontStylesheetHrefs,
  fontFaceFamilyName,
  loadAnnotateFontFaces,
} from "./fonts";

export {
  isUiTarget,
  lastTwoEqual,
  nearFirstVertex,
  eventLngLat,
  eventPoint,
  clientToLngLat,
  handleInteraction,
  setMapCursor,
  setPointerCursor,
} from "./interaction";
