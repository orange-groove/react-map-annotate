"use client";

import { Layer, Marker, Source, useMap } from "react-map-gl/maplibre";
import { createMapGlComponents } from "./gl/create-map-gl";
import type { GlKit } from "./gl/types";

const kit = {
  engine: "maplibre",
  Source,
  Layer,
  Marker,
  useMap,
} as unknown as GlKit;

export const { Annotate, AnnotateLayers, AnnotationLabel } =
  createMapGlComponents(kit);

export * from "./api";
