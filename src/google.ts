"use client";

import { GoogleAnnotateLayers } from "./google/annotate-layers";
import { createMapGlComponents } from "./gl/create-map-gl";
import { GoogleMarker } from "./google/marker";
import { useGoogleMapRef } from "./google/use-google-map-ref";
import type { GlKit } from "./gl/types";

const kit = {
  engine: "google",
  Source: () => null,
  Layer: () => null,
  Marker: GoogleMarker,
  useMap: useGoogleMapRef,
} as unknown as GlKit;

export const { Annotate, AnnotateLayers, AnnotationLabel } =
  createMapGlComponents(kit, GoogleAnnotateLayers);

export * from "./api";
