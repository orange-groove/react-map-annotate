import { MapContainer, TileLayer } from "react-leaflet";
import {
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/leaflet";
import "leaflet/dist/leaflet.css";
import "@orange-groove/react-map-annotate/styles.css";

export function LeafletExample() {
  return (
    <AnnotateProvider>
      <div style={{ position: "relative", zIndex: 0, height: "100%" }}>
        <MapContainer
          center={[40.7484, -73.9857]}
          zoom={14}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Annotate />
        </MapContainer>
      </div>
      <AnnotateToolbar />
      <AnnotateList />
    </AnnotateProvider>
  );
}
