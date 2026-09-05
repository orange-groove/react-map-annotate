"use client";

import { LeafletAnnotateLayers } from "./leaflet/annotate-layers";
import { createMapGlComponents } from "./gl/create-map-gl";
import { LeafletMarker } from "./leaflet/marker";
import { useLeafletMapRef } from "./leaflet/use-leaflet-map-ref";
import type { GlKit } from "./gl/types";

const kit = {
  engine: "leaflet",
  Source: () => null,
  Layer: () => null,
  Marker: LeafletMarker,
  useMap: useLeafletMapRef,
} as unknown as GlKit;

export const { Annotate, AnnotateLayers, AnnotationLabel } =
  createMapGlComponents(kit, LeafletAnnotateLayers);

export * from "./api";
