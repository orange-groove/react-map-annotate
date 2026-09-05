import type { ReactNode } from "react";
import { MapGlProvider } from "../gl/context";
import type { GlKit } from "../gl/types";

export const testMapGl: GlKit = {
  engine: "mapbox",
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  useMap: () => ({ current: null }),
};

export function TestMapGl({ children }: { children: ReactNode }) {
  return <MapGlProvider value={testMapGl}>{children}</MapGlProvider>;
}
