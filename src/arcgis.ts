"use client";

import { OverlayAnnotateLayers } from "./engines/overlay/annotate-layers";
import { createMapGlComponents } from "./engines/kit/create-map-gl";
import { ArcgisMarker } from "./engines/arcgis/marker";
import { useArcgisMapRef } from "./engines/arcgis/use-arcgis-map-ref";
import { withArcgisView } from "./engines/arcgis/view-context";
import type { GlKit } from "./engines/kit/types";

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

export { ArcgisViewProvider } from "./engines/arcgis/view-context";
export type { ArcgisView } from "./engines/arcgis/view";

export * from "./api";
