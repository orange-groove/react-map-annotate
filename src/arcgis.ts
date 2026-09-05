"use client";

import { OverlayAnnotateLayers } from "./overlay/annotate-layers";
import { createMapGlComponents } from "./gl/create-map-gl";
import { ArcgisMarker } from "./arcgis/marker";
import { useArcgisMapRef } from "./arcgis/use-arcgis-map-ref";
import { withArcgisView } from "./arcgis/view-context";
import type { GlKit } from "./gl/types";

const kit = {
  engine: "arcgis",
  Source: () => null,
  Layer: () => null,
  Marker: ArcgisMarker,
  useMap: useArcgisMapRef,
} as unknown as GlKit;

const created = createMapGlComponents(kit, OverlayAnnotateLayers);

export const Annotate = withArcgisView(created.Annotate);
export const AnnotateLayers = withArcgisView(created.AnnotateLayers);
export const AnnotationLabel = created.AnnotationLabel;

export { ArcgisViewProvider } from "./arcgis/view-context";
export type { ArcgisView } from "./arcgis/view";

export * from "./api";
