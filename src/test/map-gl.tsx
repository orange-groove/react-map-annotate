import type { ReactNode } from "react";
import { MapGlProvider } from "../engines/kit/context";
import type { GlKit } from "../engines/kit/types";

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
