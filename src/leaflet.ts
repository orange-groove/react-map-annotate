"use client";

import { LeafletAnnotateLayers } from "./engines/leaflet/annotate-layers";
import { createMapGlComponents } from "./engines/kit/create-map-gl";
import { LeafletMarker } from "./engines/leaflet/marker";
import { useLeafletMapRef } from "./engines/leaflet/use-leaflet-map-ref";
import type { GlKit } from "./engines/kit/types";

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
