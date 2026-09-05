"use client";

import * as React from "react";
import type { GlKit } from "./types";

const MapGlContext = React.createContext<GlKit | null>(null);

export function MapGlProvider({
  value,
  children,
}: {
  value: GlKit;
  children: React.ReactNode;
}) {
  return (
    <MapGlContext.Provider value={value}>{children}</MapGlContext.Provider>
  );
}

export function useMapGl(): GlKit {
  const kit = React.useContext(MapGlContext);
  if (!kit) {
    throw new Error(
      "Annotate map components must come from @orange-groove/react-map-annotate/mapbox, /maplibre, /google, /leaflet, or /arcgis.",
    );
  }
  return kit;
}

export function bindMapGl<P extends object>(
  kit: GlKit,
  Component: React.ComponentType<P>,
) {
  function Bound(props: P) {
    return (
      <MapGlProvider value={kit}>
        <Component {...props} />
      </MapGlProvider>
    );
  }
  Bound.displayName = `MapGl(${Component.displayName || Component.name || "Component"})`;
  return Bound;
}
