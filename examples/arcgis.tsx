import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map.js";
import MapView from "@arcgis/core/views/MapView.js";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer.js";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
  ArcgisViewProvider,
} from "@orange-groove/react-map-annotate/arcgis";
import "@arcgis/core/assets/esri/themes/light/main.css";
import "@orange-groove/react-map-annotate/styles.css";

function ArcgisMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new Map({
      layers: [
        new WebTileLayer({
          urlTemplate:
            "https://{subDomain}.tile.openstreetmap.org/{level}/{col}/{row}.png",
          subDomains: ["a", "b", "c"],
        }),
      ],
    });
    const next = new MapView({
      container,
      map,
      center: [-73.9857, 40.7484],
      zoom: 14,
    });
    setView(next);
    return () => {
      next.destroy();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <ArcgisViewProvider view={view}>
        <Annotate />
      </ArcgisViewProvider>
    </>
  );
}

export function ArcgisExample() {
  return (
    <AnnotateProvider>
      <ArcgisMap />
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
