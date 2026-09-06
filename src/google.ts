"use client";

import { GoogleAnnotateLayers } from "./engines/google/annotate-layers";
import { createMapGlComponents } from "./engines/kit/create-map-gl";
import { GoogleMarker } from "./engines/google/marker";
import { useGoogleMapRef } from "./engines/google/use-google-map-ref";
import type { GlKit } from "./engines/kit/types";

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
