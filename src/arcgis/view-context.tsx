"use client";

import * as React from "react";
import type { ArcgisView } from "./view";

const ArcgisViewContext = React.createContext<ArcgisView | null>(null);

export function ArcgisViewProvider({
  view,
  children,
}: {
  view: ArcgisView | null;
  children: React.ReactNode;
}) {
  return (
    <ArcgisViewContext.Provider value={view}>
      {children}
    </ArcgisViewContext.Provider>
  );
}

export function useArcgisView(): ArcgisView | null {
  return React.useContext(ArcgisViewContext);
}

function ArcgisViewDiscovery({ children }: { children: React.ReactNode }) {
  const provided = React.useContext(ArcgisViewContext);
  const [discovered, setDiscovered] = React.useState<ArcgisView | null>(null);
  const probeRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    if (provided) {
      setDiscovered(null);
      return;
    }
    const probe = probeRef.current;
    if (!probe) return;
    const host = probe.closest("arcgis-map, arcgis-scene") as
      (HTMLElement & { view?: ArcgisView | null }) | null;
    if (!host) return;

    const sync = () => {
      setDiscovered(host.view ?? null);
    };
    sync();
    host.addEventListener("arcgisViewReadyChange", sync);
    return () => host.removeEventListener("arcgisViewReadyChange", sync);
  }, [provided]);

  return (
    <ArcgisViewContext.Provider value={provided ?? discovered}>
      <span ref={probeRef} hidden data-rmga-arcgis-probe="" />
      {children}
    </ArcgisViewContext.Provider>
  );
}

export function withArcgisView<P extends object>(
  Component: React.ComponentType<P>,
) {
  function Bound(props: P) {
    return (
      <ArcgisViewDiscovery>
        <Component {...props} />
      </ArcgisViewDiscovery>
    );
  }
  Bound.displayName = `ArcgisView(${Component.displayName || Component.name || "Component"})`;
  return Bound;
}
