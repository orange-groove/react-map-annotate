import Map from "react-map-gl/mapbox";
import {
  Annotate,
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate/mapbox";
import "@orange-groove/react-map-annotate/styles.css";

export function MapboxExample({ token }: { token: string }) {
  return (
    <AnnotateProvider>
      <Map
        mapboxAccessToken={token}
        initialViewState={{ longitude: -73.9857, latitude: 40.7484, zoom: 14 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
      >
        <Annotate enableTerrain />
      </Map>
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
