import Map from "react-map-gl/maplibre";
import {
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import "@orange-groove/react-map-annotate/styles.css";

export function MapLibreExample() {
  return (
    <AnnotateProvider>
      <Map
        initialViewState={{ longitude: -73.9857, latitude: 40.7484, zoom: 14 }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
      >
        <Annotate />
      </Map>
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
