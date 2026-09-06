import { APIProvider, Map } from "@vis.gl/react-google-maps";
import {
  AnnotateList,
  AnnotateProvider,
  AnnotateToolbar,
} from "@orange-groove/react-map-annotate/core";
import { Annotate } from "@orange-groove/react-map-annotate/google";
import "@orange-groove/react-map-annotate/styles.css";

export function GoogleExample({ apiKey }: { apiKey: string }) {
  return (
    <APIProvider apiKey={apiKey}>
      <AnnotateProvider>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 40.7484, lng: -73.9857 }}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          <Annotate />
        </Map>
        <AnnotateToolbar />
        <AnnotateList />
      </AnnotateProvider>
    </APIProvider>
  );
}
